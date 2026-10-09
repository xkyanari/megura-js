const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { sequelize, Player, Iura, Item, Shop, Monster } = require('../src/db');
const C = require('../functions/crafting');
const { changeEquipment, statsFor } = require('../functions/equipment');
const { sellItem } = require('../functions/sell');
const { rollLoot } = require('../functions/loot');
const { migrate } = require('../scripts/migrations/2026-10-crafting');
const buy = require('../commands/slash-commands/buy');
const items = require('../assets/item_db.json');
const mobs = require('../assets/mob_db.json');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GC';
const always = () => 0;
const never = () => 0.999999;

const makePlayer = async (discordID, { wallet = 1e6, ...extra } = {}) => {
	const player = await Player.create({ discordID, guildID: G, playerName: discordID, level: 70, ...extra });
	await Iura.create({ accountID: player.accountID, walletAmount: wallet, walletName: `w${discordID}`, bankName: `b${discordID}` });
	return player;
};
const give = (player, itemName, quantity) => Item.create({ accountID: player.accountID, itemName, quantity });
const itemOf = (player, itemName) => Item.findOne({ where: { accountID: player.accountID, itemName } });
const countOf = async (player, itemName) => (await itemOf(player, itemName))?.quantity ?? 0;
const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;
const shopItem = (itemID) => items.find((item) => item.item_ID === itemID);

before(async () => {
	await resetDb();
	await Shop.bulkCreate(items);
	await Monster.bulkCreate(mobs);
});
after(closeAll);

describe('data', () => {
	test('every recipe makes and uses real shop items, and crafted items aren\'t for sale', () => {
		const names = new Set(items.map((item) => item.itemName));
		for (const recipe of C.recipes) {
			assert.ok(shopItem(recipe.item_ID), `${recipe.item_ID} is in item_db.json`);
			assert.equal(C.isForSale(shopItem(recipe.item_ID)), false);
			for (const input of recipe.inputs) assert.ok(names.has(input.item), `${input.item} is in item_db.json`);
		}
		for (const tier of C.materials.tiers) {
			assert.ok(names.has(tier.metal) && names.has(tier.hide));
		}
		assert.equal(C.isForSale(shopItem('iron')), true);
		assert.equal(C.isForSale(shopItem('starmetal')), false);
		assert.equal(C.isForSale(shopItem('sword')), true);
	});

	test('materials follow item level and slot', () => {
		assert.equal(C.materialFor(shopItem('sword')), 'Iron Shard');
		assert.equal(C.materialFor(shopItem('cloak')), 'Spirit Silk'); // armor, level 20
		assert.equal(C.materialFor(shopItem('kukri')), 'Mythril Chunk'); // weapon, level 40
		assert.equal(C.materialFor(shopItem('tooth')), 'Phoenix Down'); // accessory, level 60
	});
});

describe('upgrades', () => {
	test('a success raises the level, takes the cost, and an equipped item\'s stats follow', async () => {
		const player = await makePlayer('U1', { totalAttack: 1000 });
		await give(player, 'Talkative Blade', 1);
		await give(player, 'Iron Shard', 100);
		assert.equal((await changeEquipment(player.accountID, 'sword', 1, true)).ok, true);
		await player.reload();
		assert.equal(player.totalAttack, 1050);

		const result = await C.upgradeItem(player.accountID, 'sword', { random: always });
		assert.deepEqual([result.ok, result.success, result.from, result.to], [true, true, 0, 1]);
		assert.equal(await countOf(player, 'Iron Shard'), 98);
		assert.equal(await walletOf(player), 1e6 - C.upgradeCost(shopItem('sword'), 1).iura);
		await player.reload();
		assert.equal(player.totalAttack, 1000 + statsFor(shopItem('sword'), 1).totalAttack);

		// unequipping gives back exactly what is on
		assert.equal((await changeEquipment(player.accountID, 'sword', 1, false)).ok, true);
		await player.reload();
		assert.equal(player.totalAttack, 1000);
	});

	test('a failure below +3 keeps the level; from +3 up it drops one, unless warded', async () => {
		const player = await makePlayer('U2');
		await give(player, 'Talkative Blade', 1);
		await give(player, 'Iron Shard', 200);
		await give(player, 'Ward Stone', 1);

		assert.equal((await C.upgradeItem(player.accountID, 'sword', { random: always })).to, 1);
		const keep = await C.upgradeItem(player.accountID, 'sword', { random: never });
		assert.deepEqual([keep.success, keep.to], [false, 1]);

		await (await itemOf(player, 'Talkative Blade')).update({ upgradeLevel: 3 });
		const drop = await C.upgradeItem(player.accountID, 'sword', { random: never });
		assert.deepEqual([drop.success, drop.from, drop.to], [false, 3, 2]);

		await (await itemOf(player, 'Talkative Blade')).update({ upgradeLevel: 1 });
		const unneeded = await C.upgradeItem(player.accountID, 'sword', { ward: true, random: never });
		assert.deepEqual([unneeded.success, unneeded.to, unneeded.warded], [false, 1, false], 'no ward used below +3');
		assert.equal(await countOf(player, 'Ward Stone'), 1);

		await (await itemOf(player, 'Talkative Blade')).update({ upgradeLevel: 3 });
		const saved = await C.upgradeItem(player.accountID, 'sword', { ward: true, random: never });
		assert.deepEqual([saved.success, saved.to, saved.warded], [false, 3, true]);
		assert.equal(await countOf(player, 'Ward Stone'), 0);
		assert.equal((await C.upgradeItem(player.accountID, 'sword', { ward: true })).reason, 'no ward');
	});

	test('the odds are 100 / 90 / 75 / 60 / 45%, and +5 is the cap', async () => {
		assert.deepEqual(C.UPGRADE_CHANCE, [1, 0.9, 0.75, 0.6, 0.45]);
		const player = await makePlayer('U3');
		await give(player, 'Talkative Blade', 1);
		await give(player, 'Iron Shard', 100);
		for (let level = 1; level <= C.MAX_UPGRADE; level++) {
			assert.equal((await C.upgradeItem(player.accountID, 'sword', { random: always })).to, level);
		}
		assert.equal((await C.upgradeItem(player.accountID, 'sword', { random: always })).reason, 'max');
		assert.deepEqual(statsFor(shopItem('sword'), 5), { totalHealth: 0, totalAttack: 75, totalDefense: 0 });
	});

	test('refusals take nothing', async () => {
		const player = await makePlayer('U4', { wallet: 5 });
		assert.equal((await C.upgradeItem(player.accountID, 'sword')).reason, 'not owned');
		await give(player, 'Healing Potion', 1);
		assert.equal((await C.upgradeItem(player.accountID, 'hpotion')).reason, 'not upgradable');
		await give(player, 'Talkative Blade', 1);
		assert.equal((await C.upgradeItem(player.accountID, 'sword')).reason, 'materials');
		await give(player, 'Iron Shard', 2);
		assert.equal((await C.upgradeItem(player.accountID, 'sword')).reason, 'iura');
		assert.equal(await countOf(player, 'Iron Shard'), 2);
		assert.equal(await walletOf(player), 5);
	});

	test('selling the last copy loses the upgrade', async () => {
		const player = await makePlayer('U5');
		await Item.create({ accountID: player.accountID, itemName: 'Talkative Blade', quantity: 2, upgradeLevel: 4 });
		await sellItem(player.accountID, 'sword', 1);
		assert.equal((await itemOf(player, 'Talkative Blade')).upgradeLevel, 4);
		await sellItem(player.accountID, 'sword', 1);
		assert.equal((await itemOf(player, 'Talkative Blade')).upgradeLevel, 0);
	});
});

describe('crafting', () => {
	test('takes exactly the inputs and IURA, and gives the item', async () => {
		const player = await makePlayer('CR1');
		await give(player, 'Iron Shard', 30);
		await give(player, 'Arcane Dust', 10);
		const result = await C.craftItem(player.accountID, 'emberblade', 2);
		assert.deepEqual([result.ok, result.itemName, result.amount], [true, 'Emberforged Blade', 2]);
		assert.equal(await countOf(player, 'Iron Shard'), 6);
		assert.equal(await countOf(player, 'Arcane Dust'), 4);
		assert.equal(await countOf(player, 'Emberforged Blade'), 2);
		assert.equal(await walletOf(player), 1e6 - 800);
	});

	test('refuses what\'s missing, unknown recipes and low levels, taking nothing', async () => {
		const player = await makePlayer('CR2', { level: 5 });
		await give(player, 'Iron Shard', 5);
		assert.equal((await C.craftItem(player.accountID, 'sword')).reason, 'unknown');
		assert.equal((await C.craftItem(player.accountID, 'emberblade')).reason, 'level');
		await player.update({ level: 10 });
		const missing = await C.craftItem(player.accountID, 'emberblade');
		assert.equal(missing.reason, 'materials');
		assert.deepEqual(missing.missing, [{ item: 'Iron Shard', need: 12, have: 5 }, { item: 'Arcane Dust', need: 3, have: 0 }]);
		assert.equal(await countOf(player, 'Iron Shard'), 5);
		assert.equal((await C.craftItem(player.accountID, 'ward', 0)).reason, 'amount');
	});
});

describe('salvage', () => {
	test('gives tier materials and dust per copy, plus the upgrade on the last copy', async () => {
		const player = await makePlayer('S1');
		// Ancient Cross-ish armor at level 60 is worth 25000: capped at 5 per copy
		await Item.create({ accountID: player.accountID, itemName: shopItem('cross').itemName, quantity: 2, upgradeLevel: 3 });
		const result = await C.salvageItem(player.accountID, 'cross', 2);
		assert.deepEqual(result.gained, [{ item: 'Phoenix Down', amount: 5 + 5 + 3 }, { item: 'Arcane Dust', amount: 2 }]);
		const left = await itemOf(player, shopItem('cross').itemName);
		assert.deepEqual([left.quantity, left.upgradeLevel], [0, 0]);
	});

	test('nothing salvages into more than it costs, so buy, salvage, sell can\'t make IURA', async () => {
		const { sellPrice } = require('../functions/sell');
		const priceOf = (name) => items.find((item) => item.itemName === name).price;
		for (const item of items) {
			if (!['weapons', 'armor', 'miscellaneous'].includes(item.category) || item.price < C.MIN_SALVAGE_PRICE) continue;
			const resale = C.salvageYield(item).reduce((sum, g) => sum + sellPrice(priceOf(g.item)) * g.amount, 0);
			assert.ok(resale < item.price, `${item.itemName}: salvage resells for ${resale}, costs ${item.price}`);
		}
		const player = await makePlayer('S3');
		await give(player, 'Simple Rock', 1);
		assert.equal((await C.salvageItem(player.accountID, 'rock')).reason, 'not salvageable');
	});

	test('only unequipped gear', async () => {
		const player = await makePlayer('S2');
		await give(player, 'Healing Potion', 1);
		assert.equal((await C.salvageItem(player.accountID, 'hpotion')).reason, 'not salvageable');
		await give(player, shopItem('hammer').itemName, 1);
		await changeEquipment(player.accountID, 'hammer', 1, true);
		assert.equal((await C.salvageItem(player.accountID, 'hammer')).reason, 'not enough');
	});
});

describe('drops and the shop', () => {
	test('a win can drop a material of the player\'s tier', async () => {
		const player = await makePlayer('D1', { level: 45 });
		assert.equal(await C.rollMaterial(player, { random: never }), null);
		const found = await C.rollMaterial(player, { random: () => 0.2 });
		assert.deepEqual(found, { item: 'Mythril Chunk', amount: 1 });
		assert.equal(await countOf(player, 'Mythril Chunk'), 1);
	});

	test('crafted items never drop as loot', async () => {
		const player = await makePlayer('D2');
		for (let i = 0; i < 40; i++) {
			const item = await rollLoot(player, 'Nobody In Particular', { guaranteed: true, random: () => (i + 0.5) / 40 });
			assert.ok(!C.recipes.some((recipe) => shopItem(recipe.item_ID).itemName === item), `${item} isn't crafted`);
		}
	});

	test('/buy refuses crafted items and unsold materials', async () => {
		await makePlayer('B1');
		for (const id of ['emberblade', 'starmetal']) {
			const rec = recorder();
			await buy.execute({
				member: { id: 'B1' },
				guild: { id: G },
				options: { getString: () => id, getInteger: () => 1 },
				reply: async (payload) => rec.push('reply', payload),
			});
			assert.match(rec.content(0), /can only be crafted or found/);
		}
	});
});

test('the migration adds the column and the missing items, and can run again', async () => {
	const queryInterface = sequelize.getQueryInterface();
	await queryInterface.removeColumn('Item', 'upgradeLevel');
	await Shop.destroy({ where: { guildID: null, item_ID: ['ward', 'starfall'] } });

	const logs = [];
	await migrate({ dryRun: true, log: (line) => logs.push(line) });
	assert.match(logs.join('\n'), /Add column Item.upgradeLevel/);
	assert.match(logs.join('\n'), /Add 2 shop item\(s\): Ward Stone, Starfall Edge/);
	assert.ok(!(await queryInterface.describeTable('Item')).upgradeLevel, 'a dry run changes nothing');

	await migrate({ log: () => undefined });
	assert.ok((await queryInterface.describeTable('Item')).upgradeLevel);
	assert.equal(await Shop.count({ where: { guildID: null, item_ID: ['ward', 'starfall'] } }), 2);

	const again = [];
	await migrate({ log: (line) => again.push(line) });
	assert.match(again.join('\n'), /already there[\s\S]*already has every item/);
});
