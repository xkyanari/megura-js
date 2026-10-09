const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura, Item, Shop, Monster } = require('../src/db');
const { rollLoot, loadConsumables, consumeItem } = require('../functions/loot');
const { claimDaily, streakReward } = require('../functions/daily');
const { simulateBattle } = require('../functions/battle');
const { executeAttack } = require('../functions/attack');
const { migrate } = require('../scripts/migrations/2026-10-gameplay');
const items = require('../assets/item_db.json');
const mobs = require('../assets/mob_db.json');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GP';
const HOUR = 60 * 60 * 1000;
const noWait = async () => undefined;

const makePlayer = async (discordID, extra = {}) => {
	const player = await Player.create({ discordID, guildID: G, playerName: discordID, ...extra });
	await Iura.create({ accountID: player.accountID, walletAmount: 0, walletName: `w${discordID}`, bankName: `b${discordID}` });
	return player;
};
const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;
const quantityOf = async (player, itemName) => (await Item.findOne({ where: { accountID: player.accountID, itemName } }))?.quantity ?? 0;

before(async () => {
	await resetDb();
	await Shop.bulkCreate(items);
});
after(closeAll);

describe('loot', () => {
	test('a win drops from the monster\'s loot table, and only real shop items', async () => {
		const player = await makePlayer('LOOT1');
		// "Healing Potion" is cheapest in Beelzebub's table, so the lowest roll picks it
		const name = await rollLoot(player, 'Beelzebub', { random: () => 0 });
		assert.ok(['Healing Potion', 'Rotten Bandage', 'Simple Rock'].includes(name));
		assert.equal(await quantityOf(player, name), 1);
		await player.reload();
		assert.equal(player.itemsEarned, 1);
	});

	test('no drop past the drop chance; monsters without a table drop low-level misc or consumables', async () => {
		const player = await makePlayer('LOOT2', { level: 1 });
		assert.equal(await rollLoot(player, 'Beelzebub', { random: () => 0.99 }), null);

		for (let i = 0; i < 20; i++) {
			const name = await rollLoot(player, 'Wyvern', { random: () => (i / 20) * 0.29 });
			const shopItem = items.find((item) => item.itemName === name);
			assert.ok(shopItem, `${name} is a shop item`);
			assert.ok(['miscellaneous', 'consumables'].includes(shopItem.category));
			assert.ok(shopItem.level <= 1);
		}
	});
});

describe('consumables', () => {
	test('used when health runs low, at most twice, and each one comes out of the inventory', async () => {
		const player = await makePlayer('CON1');
		await Item.create({ accountID: player.accountID, itemName: 'Healing Potion', quantity: 5 });
		const consumables = await loadConsumables(player.accountID);
		assert.ok(consumables.length >= 1);

		const fighter = { playerName: 'P', level: 1, totalHealth: 1000, totalAttack: 1, totalDefense: 0 };
		// hits for exactly 300 a turn (level 0: no critical hits) and can't be hurt: the player must drink, then lose
		const brute = { playerName: 'B', level: 0, totalHealth: 1000, totalAttack: 300 / 1.75, totalDefense: 1e9 };
		const embeds = [];
		const winner = await simulateBattle(null, fighter, brute, {
			consumables, delay: noWait, render: async (embed) => embeds.push(embed),
		});
		assert.equal(winner, brute);
		assert.equal(await quantityOf(player, 'Healing Potion'), 3, 'two potions used');
		assert.match(embeds.at(-1).data.description, /uses Healing Potion/);
	});

	test('can\'t take more than the player has, even at once', async () => {
		const player = await makePlayer('CON2');
		await Item.create({ accountID: player.accountID, itemName: 'Attack Potion', quantity: 1 });
		const results = await Promise.all([1, 2, 3].map(() => consumeItem(player.accountID, 'Attack Potion')));
		assert.equal(results.filter(Boolean).length, 1);
		assert.equal(await quantityOf(player, 'Attack Potion'), 0);
	});
});

describe('daily streak', () => {
	test('grows within 48 hours, resets after, and the bonus is capped', async () => {
		const player = await makePlayer('DAY1');
		const start = Date.UTC(2026, 0, 1);

		assert.deepEqual(await claimDaily(player.accountID, 100, start), { streak: 1, reward: 100 });
		assert.deepEqual(await claimDaily(player.accountID, 100, start + 30 * HOUR), { streak: 2, reward: 110 });
		assert.deepEqual(await claimDaily(player.accountID, 100, start + 90 * HOUR), { streak: 1, reward: 100 }, 'missed a day');
		assert.equal(await walletOf(player), 310);
		await player.reload();
		assert.equal(player.iuraEarned, 310);

		assert.equal(streakReward(100, 7), 160);
		assert.equal(streakReward(100, 30), 160);
	});
});

describe('migration', () => {
	test('unequips stacks, consumables and over-limit items, gives the stats back, and is safe to rerun', async () => {
		const player = await makePlayer('MIG1', { totalAttack: 500, totalDefense: 500, totalHealth: 2000 });
		const equip = async (itemName, equippedAmount) => {
			const shopItem = items.find((item) => item.itemName === itemName);
			await Item.create({ accountID: player.accountID, itemName, quantity: 0, equippedAmount, equipped: true });
			await player.increment({
				totalAttack: shopItem.totalAttack * equippedAmount,
				totalDefense: shopItem.totalDefense * equippedAmount,
				totalHealth: shopItem.totalHealth * equippedAmount,
			});
		};
		await equip('Talkative Blade', 20);
		await equip('Quiet Negotiator', 1);
		await equip('Boiled Egg', 3);
		await player.update({ weapon: 'Talkative Blade' });

		await migrate({ log: () => undefined });
		await player.reload();
		// Talkative Blade and Quiet Negotiator are both level 1; the pricier blade stays on
		assert.equal(player.totalAttack, 550);
		assert.equal(player.totalDefense, 500);
		assert.equal(player.totalHealth, 2000);
		assert.equal(player.weapon, 'Talkative Blade');
		const blade = await Item.findOne({ where: { accountID: player.accountID, itemName: 'Talkative Blade' } });
		assert.deepEqual([blade.quantity, blade.equippedAmount], [19, 1]);
		assert.equal(await quantityOf(player, 'Boiled Egg'), 3);

		assert.deepEqual(await migrate({ log: () => undefined }), [], 'nothing left to do');
	});
});

describe('/attack', () => {
	test('the whole fight is one reply, and a win pays out by level', async () => {
		await Monster.create(mobs[0]);
		// strong enough to win every time; level 3 so one win doesn't level up
		const player = await makePlayer('ATK1', { level: 3, totalAttack: 100000 });
		const rec = recorder();
		const sent = [];
		const interaction = {
			member: { id: 'ATK1' },
			guild: { id: G },
			user: { id: 'ATK1' },
			channel: { send: async (payload) => sent.push(payload) },
			deferReply: async () => rec.push('defer'),
			editReply: async (payload) => rec.push('editReply', payload),
			followUp: async (payload) => rec.push('followUp', payload),
		};

		await executeAttack(interaction, { delay: noWait });

		assert.equal(sent.length, 0, 'nothing posted outside the reply');
		const [kind, last] = rec.calls.at(-1);
		assert.equal(kind, 'editReply');
		const result = last.embeds[0].data.fields.find((field) => field.name === 'Result').value;
		assert.match(result, /WELL DONE/);
		assert.match(result, new RegExp(`${mobs[0].iuraDropped * 3} IURA`));
		assert.equal(await walletOf(player), mobs[0].iuraDropped * 3);
		await player.reload();
		assert.equal(player.expGained, mobs[0].expDropped * 3);
		assert.equal(player.monsterKills, 1);
	});
});
