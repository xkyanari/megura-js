const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { sequelize, Player, Guild, Shop, Order } = require('../src/db');
const { salesReport, salesCsv } = require('../functions/sales');
const { handleOrderButton } = require('../functions/order');
const { migrate } = require('../scripts/migrations/2026-10-order-sales');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GSALE';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 9, 12);

const staffClick = (messageID) => {
	const rec = recorder();
	return {
		rec,
		member: { permissions: { has: () => true } },
		user: { id: 'STAFF' },
		guild: { id: G },
		message: { id: messageID },
		reply: async (payload) => rec.push('reply', payload),
	};
};

before(async () => {
	await resetDb();
	await Guild.create({ guildID: G, walletAmount: 0 });
	await Player.create({ discordID: 'B', guildID: G, oresEarned: 1000 });
	await Shop.create({ itemName: 'Role', item_ID: 'role', category: 'digital', price: 30, quantity: 10, guildID: G });
	await Shop.create({ itemName: '=HYPERLINK("x")', item_ID: 'evil', category: 'digital', price: 5, quantity: 10, guildID: G });
});
after(closeAll);

describe('recording sales', () => {
	test('every purchase is recorded with what was paid, webhook or not', async () => {
		const order = await Shop.buyItem('Role', 1, 'B', G);
		assert.deepEqual([order.status, order.price, order.itemName], ['pending', 30, 'Role']);
		assert.ok(order.orderedAt instanceof Date);
		assert.equal(await Order.count({ where: { guildID: G } }), 1);
	});

	test('a cancelled order refunds what was paid, even after a price change', async () => {
		const order = await Shop.buyItem('Role', 1, 'B', G);
		await order.update({ messageID: 'msg-1' });
		await Shop.update({ price: 999 }, { where: { item_ID: 'role', guildID: G } });

		const oresBefore = (await Player.findOne({ where: { discordID: 'B', guildID: G } })).oresEarned;
		await handleOrderButton(staffClick('msg-1'), 'cancelled');
		const oresAfter = (await Player.findOne({ where: { discordID: 'B', guildID: G } })).oresEarned;
		assert.equal(oresAfter - oresBefore, 30);
		await Shop.update({ price: 30 }, { where: { item_ID: 'role', guildID: G } });
	});
});

describe('the report', () => {
	test('counts by status, revenue from completed orders, top items and what is waiting', async () => {
		await Order.destroy({ where: { guildID: G } });
		const add = (itemName, status, price, daysAgo) =>
			Order.create({ guildID: G, discordID: 'B', itemName, status, price, orderedAt: new Date(NOW - daysAgo * DAY) });
		await add('Role', 'completed', 30, 1);
		await add('Role', 'completed', 30, 2);
		await add('Badge', 'completed', 50, 3);
		await add('Badge', 'pending', 50, 6);
		await add('Role', 'cancelled', 30, 1);
		await add('Old', 'completed', 40, 20);
		await Order.create({ guildID: G, discordID: 'B', itemName: 'Ancient', status: 'completed', price: null, orderedAt: null });
		await Order.create({ guildID: 'OTHER', discordID: 'B', itemName: 'Role', status: 'completed', price: 30, orderedAt: new Date(NOW) });

		const week = await salesReport(G, '7d', NOW);
		assert.equal(week.total, 5);
		assert.deepEqual(week.byStatus, { pending: 1, processing: 0, completed: 3, cancelled: 1 });
		assert.equal(week.revenue, 110);
		assert.deepEqual(week.topItems.map((item) => [item.itemName, item.sold, item.revenue]), [['Role', 2, 60], ['Badge', 2, 50]], 'equal sales: more revenue first');
		assert.deepEqual(week.oldestPending.map((order) => order.itemName), ['Badge']);

		const all = await salesReport(G, 'all', NOW);
		assert.deepEqual([all.total, all.revenue, all.unpriced], [7, 150, 1]);
	});

	test('the CSV has one row per order, with formula-looking names neutralized', async () => {
		await Order.create({ guildID: G, discordID: 'B', itemName: '=HYPERLINK("x")', status: 'pending', price: 5, orderedAt: new Date(NOW) });
		const csv = await salesCsv(G, 'all', NOW);
		const lines = csv.trim().split('\n');
		assert.equal(lines[0], 'order,buyer_id,item,price_ores,status,ordered_at');
		assert.equal(lines.length, 1 + await Order.count({ where: { guildID: G } }));
		assert.ok(lines.some((line) => line.includes('"\'=HYPERLINK(""x"")"')), csv);
	});
});

test('the migration adds the sales columns to an existing Order table, once', async () => {
	const queryInterface = sequelize.getQueryInterface();
	await queryInterface.removeColumn('Order', 'price');
	await queryInterface.removeColumn('Order', 'orderedAt');
	assert.deepEqual(await migrate({ log: () => undefined }), ['price', 'orderedAt']);
	assert.deepEqual(await migrate({ log: () => undefined }), []);
	const columns = await queryInterface.describeTable('Order');
	assert.equal(columns.price.allowNull, true);
});
