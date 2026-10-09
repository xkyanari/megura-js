const { test, before, after } = require('node:test');
const assert = require('node:assert');
const webhook = require('../functions/webhook');

// don't post to Discord webhooks; must be stubbed before the button module loads
webhook.purchaseStatus = async () => undefined;

const { Player, Guild, Shop, Order } = require('../src/db');
const cancelled = require('../components/buttons/cancelled');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'G1';
const guildWallet = async () => (await Guild.findOne({ where: { guildID: G } })).walletAmount;
const stock = async () => (await Shop.findOne({ where: { itemName: 'Role' } })).quantity;

const click = (messageID) => {
	const rec = recorder();
	return {
		rec,
		message: { id: messageID },
		guild: { id: G },
		user: { id: 'ADMIN' },
		member: { permissions: { has: () => true } },
		async reply(payload) { rec.push('reply', payload); },
	};
};

before(async () => {
	await resetDb();
	await Guild.create({ guildID: G, walletAmount: 1000 });
	await Player.create({ discordID: 'B', guildID: G, oresEarned: 0 });
	await Shop.create({ itemName: 'Role', price: 30, quantity: 0, guildID: G });
});

after(closeAll);

test('a double click on Cancel refunds only once', async () => {
	await Order.create({ messageID: 'm1', guildID: G, discordID: 'B', itemName: 'Role', status: 'pending' });
	const [first, second] = [click('m1'), click('m1')];

	await Promise.all([cancelled.execute(first), cancelled.execute(second)]);

	assert.equal((await Player.findOne({ where: { discordID: 'B' } })).oresEarned, 30);
	assert.equal(await guildWallet(), 970);
	assert.equal(await stock(), 1);
	const replies = [first.rec.content(0), second.rec.content(0)];
	assert.equal(replies.filter((r) => /already cancelled/.test(r)).length, 1);
});

test('cancelling for a buyer who reset their profile keeps the ores in the guild', async () => {
	await Order.create({ messageID: 'm2', guildID: G, discordID: 'GONE', itemName: 'Role', status: 'pending' });
	const i = click('m2');

	await cancelled.execute(i);

	assert.equal(await guildWallet(), 970);
	assert.equal(await stock(), 2);
	assert.match(i.rec.content(0), /no longer has a profile/);
	assert.equal((await Order.findOne({ where: { messageID: 'm2' } })).status, 'cancelled');
});

test('a failed refund puts the order back to its previous status', async () => {
	await Order.create({ messageID: 'm3', guildID: G, discordID: 'B', itemName: 'Deleted', status: 'processing' });

	await assert.rejects(cancelled.execute(click('m3')), /item not found/);

	assert.equal((await Order.findOne({ where: { messageID: 'm3' } })).status, 'processing');
});

test('a finished order can\'t be reopened, so it can\'t be refunded or delivered twice', async () => {
	const processing = require('../components/buttons/processing');
	const completed = require('../components/buttons/completed');
	await Order.create({ messageID: 'm4', guildID: G, discordID: 'B', itemName: 'Role', status: 'pending' });
	const oresBefore = (await Player.findOne({ where: { discordID: 'B' } })).oresEarned;

	await cancelled.execute(click('m4'));
	const reopen = click('m4');
	await processing.execute(reopen);
	assert.match(reopen.rec.content(0), /already cancelled/);
	const complete = click('m4');
	await completed.execute(complete);
	assert.match(complete.rec.content(0), /already cancelled/);
	await cancelled.execute(click('m4'));

	assert.equal((await Player.findOne({ where: { discordID: 'B' } })).oresEarned, oresBefore + 30, 'refunded once');
	assert.equal((await Order.findOne({ where: { messageID: 'm4' } })).status, 'cancelled');
});

test('order buttons are staff-only', async () => {
	await Order.create({ messageID: 'm5', guildID: G, discordID: 'B', itemName: 'Role', status: 'pending' });
	const member = click('m5');
	member.member = { permissions: { has: () => false } };
	await cancelled.execute(member);
	assert.match(member.rec.content(0), /Only staff/);
	assert.equal((await Order.findOne({ where: { messageID: 'm5' } })).status, 'pending');
});
