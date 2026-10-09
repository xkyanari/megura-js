const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { sequelize, Player, Iura, Item, Shop, Monster, Guild, QuestProgress, FactionScore } = require('../src/db');
const V = require('../src/vars');
const { simulateBattle } = require('../functions/battle');
const { sellItem, sellPrice } = require('../functions/sell');
const { fightOut } = require('../functions/arena');
const Q = require('../functions/quests');
const F = require('../functions/factions');
const { weekKey, previousWeekKey } = require('../functions/period');
const { executeAttack } = require('../functions/attack');
const { migrate: migrateHealth } = require('../scripts/migrations/2026-10-health-curve');
const items = require('../assets/item_db.json');
const mobs = require('../assets/mob_db.json');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GQ';
const DAY = 24 * 60 * 60 * 1000;
const noWait = async () => undefined;

const makePlayer = async (discordID, extra = {}) => {
	const player = await Player.create({ discordID, guildID: G, playerName: discordID, ...extra });
	await Iura.create({ accountID: player.accountID, walletAmount: 0, walletName: `w${discordID}`, bankName: `b${discordID}` });
	return player;
};
const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;

before(async () => {
	await resetDb();
	await sequelize.query('DROP TABLE IF EXISTS `_migrations`');
	await Shop.bulkCreate(items);
	await Shop.create({ itemName: 'VIP pass', item_ID: 'vip', category: 'whitelist', price: 500, quantity: 5, guildID: G });
	await Guild.create({ guildID: G, margarethaName: 'Dawnguard', cerberonName: 'Ironmind' });
});
after(closeAll);

describe('selling', () => {
	test('pays 40% of the price (at least 1 each) for unequipped copies only', async () => {
		const player = await makePlayer('S1');
		await Item.create({ accountID: player.accountID, itemName: 'Talkative Blade', quantity: 2, equippedAmount: 1, equipped: true });
		await Item.create({ accountID: player.accountID, itemName: 'Simple Rock', quantity: 5 });

		assert.deepEqual(await sellItem(player.accountID, 'sword', 3), { ok: false, reason: 'not enough' }, 'the equipped copy stays');
		assert.deepEqual(await sellItem(player.accountID, 'sword', 2), { ok: true, itemName: 'Talkative Blade', total: 40 });
		assert.equal(sellPrice(1), 1);
		const rock = items.find((item) => item.itemName === 'Simple Rock');
		assert.equal((await sellItem(player.accountID, rock.item_ID, 5)).total, 5);

		assert.equal(await walletOf(player), 45);
		const blade = await Item.findOne({ where: { accountID: player.accountID, itemName: 'Talkative Blade' } });
		assert.deepEqual([blade.quantity, blade.equippedAmount], [0, 1]);
		await player.reload();
		assert.equal(player.itemsTraded, 7);
	});

	test('refuses bad amounts, special-shop items, and can\'t oversell at once', async () => {
		const player = await makePlayer('S2');
		await Item.create({ accountID: player.accountID, itemName: 'VIP pass', quantity: 1 });
		await Item.create({ accountID: player.accountID, itemName: 'Healing Potion', quantity: 1 });

		assert.equal((await sellItem(player.accountID, 'vip', 1)).reason, 'not found');
		assert.equal((await sellItem(player.accountID, 'hpotion', 0)).reason, 'amount');
		const results = await Promise.all([1, 2, 3].map(() => sellItem(player.accountID, 'hpotion', 1)));
		assert.equal(results.filter((r) => r.ok).length, 1);
		assert.equal(await walletOf(player), sellPrice(60));
	});
});

describe('health curve', () => {
	test('level 1 is unchanged, and health keeps growing', () => {
		assert.equal(V.healthPerLevel(1), V.baseHealth);
		for (let level = 2; level <= 80; level++) assert.ok(V.healthPerLevel(level) > V.healthPerLevel(level - 1));
	});

	test('an even duel lasts about the same number of rounds at every level', async () => {
		const rounds = async (level) => {
			const fighter = (name) => ({ playerName: name, level, totalHealth: V.healthPerLevel(level), totalAttack: V.attackPerLevel(level), totalDefense: V.defensePerLevel(level) });
			let total = 0;
			for (let i = 0; i < 300; i++) {
				let turns = 0;
				await simulateBattle(null, fighter('A'), fighter('B'), { delay: noWait, render: async () => { turns++; } });
				total += turns;
			}
			return total / 300;
		};
		const atOne = await rounds(1);
		for (const level of [10, 30, 60]) {
			const at = await rounds(level);
			assert.ok(Math.abs(at - atOne) <= 1.5, `level ${level}: ${at.toFixed(1)} rounds vs ${atOne.toFixed(1)} at level 1`);
		}
	});

	test('the migration lifts everyone to the new curve once, keeping health from gear', async () => {
		const low = await makePlayer('H1', { level: 1, totalHealth: 2000 });
		const geared = await makePlayer('H2', { level: 10, totalHealth: V.legacyHealthPerLevel(10) + 500 });

		await migrateHealth({ log: () => undefined });
		await migrateHealth({ log: () => undefined });
		assert.equal((await low.reload()).totalHealth, 2000);
		assert.equal((await geared.reload()).totalHealth, V.healthPerLevel(10) + 500, 'applied once');
	});
});

describe('arena duels', () => {
	const fighter = (name, attack) => ({ playerName: name, level: 1, totalHealth: 2000, totalAttack: attack, totalDefense: 500 });

	test('the stronger fighter usually wins, but not every time', async () => {
		let strongWins = 0;
		for (let i = 0; i < 400; i++) {
			const strong = fighter('S', 560);
			const { winner, loser } = await fightOut(strong, fighter('W', 500));
			assert.notEqual(winner, loser);
			if (winner === strong) strongWins++;
		}
		assert.ok(strongWins > 220 && strongWins < 400, `${strongWins}/400`);
	});

	test('a fight nobody can win is settled by a coin flip', async () => {
		const tank = (name) => ({ ...fighter(name, 1), totalDefense: 1e9 });
		const a = tank('A');
		const { winner } = await fightOut(a, tank('B'), () => 0.1);
		assert.equal(winner, a);
	});
});

describe('quests', () => {
	const NOW = Date.UTC(2026, 9, 9, 12);

	test('each player gets a steady set: 3 daily and 1 weekly, faction quests only for faction members', () => {
		const quests = Q.questsFor(42, { now: NOW });
		assert.deepEqual(quests, Q.questsFor(42, { now: NOW + 60 * 60 * 1000 }), 'same set all day');
		assert.equal(quests.filter((q) => q.period === 'daily').length, Q.DAILY_COUNT);
		assert.equal(quests.filter((q) => q.period === 'weekly').length, Q.WEEKLY_COUNT);
		assert.ok(quests.every((q) => !Q.OBJECTIVES[q.objective].needsFaction));

		const withFaction = Q.questsFor(42, { hasFaction: true, now: NOW });
		assert.equal(withFaction.length, Q.DAILY_COUNT + Q.WEEKLY_COUNT);
		const days = new Set(Array.from({ length: 10 }, (_, i) => Q.questsFor(42, { hasFaction: true, now: NOW + i * DAY })
			.filter((q) => q.period === 'daily').map((q) => q.objective).sort().join()));
		assert.ok(days.size > 1, 'the daily set changes from day to day');
	});

	test('progress pays a completed quest once, scaled by level', async () => {
		const player = await makePlayer('Q1', { level: 4 });
		const quest = Q.questsFor(player.accountID, { now: NOW }).find((q) => q.objective === 'monsterWins');
		assert.ok(quest, 'without a faction, every non-faction daily is assigned, monster wins included');

		const completed = [];
		for (let i = 0; i < quest.target + 2; i++) {
			completed.push(...await Q.recordProgress(player.accountID, 'monsterWin', { now: NOW }));
		}
		const daily = completed.filter((c) => c.period === quest.period && c.text === quest.text);
		assert.equal(daily.length, 1);
		assert.deepEqual([daily[0].iura, daily[0].exp], [quest.iura * 4, quest.exp * 4]);
		assert.equal(await walletOf(player), completed.reduce((sum, c) => sum + c.iura, 0));

		const board = await Q.questBoard(await player.reload(), { now: NOW });
		const row = board.find((q) => q.periodKey === quest.periodKey && q.objective === 'monsterWins');
		assert.deepEqual([row.progress, row.completed], [quest.target, true]);
		assert.deepEqual(await Q.recordProgress(player.accountID, 'rivalKill', { now: NOW }), [], 'no faction, no faction quests');
	});

	test('a new day starts fresh', async () => {
		const player = await makePlayer('Q2');
		await Q.recordProgress(player.accountID, 'monsterWin', { now: NOW });
		const tomorrow = await Q.questBoard(player, { now: NOW + DAY });
		assert.ok(tomorrow.filter((q) => q.period === 'daily').every((q) => q.progress === 0));
		assert.equal(await QuestProgress.count({ where: { accountID: player.accountID } }) > 0, true);
	});
});

describe('factions', () => {
	test('a player\'s faction is matched by the server\'s role names', async () => {
		const guild = await Guild.findOne({ where: { guildID: G } });
		assert.equal(F.playerFaction({ faction: 'Dawnguard' }, guild), 'Margaretha');
		assert.equal(F.playerFaction({ faction: 'ironmind ' }, guild), 'Cerberon');
		assert.equal(F.playerFaction({ faction: 'Cerberon' }, null), 'Cerberon');
		assert.equal(F.playerFaction({ faction: 'Wanderer' }, guild), null);
		assert.equal(F.isRival('Margaretha', 'Cerberon'), true);
		assert.equal(F.isRival('Margaretha', 'Margaretha'), false);
		assert.equal(F.isRival(null, 'Cerberon'), false);
		assert.equal(F.factionLabel('Cerberon', guild), 'Ironmind');
	});

	test('points add up per week', async () => {
		const now = Date.UTC(2026, 9, 9);
		await F.addFactionPoint('GF', 'Cerberon', now);
		await F.addFactionPoint('GF', 'Cerberon', now);
		await F.addFactionPoint('GF', 'Margaretha', now - 7 * DAY);
		assert.deepEqual(await F.standings('GF', now), {
			thisWeek: { Margaretha: 0, Cerberon: 2 },
			lastWeek: { Margaretha: 1, Cerberon: 0 },
		});
		assert.notEqual(weekKey(now), previousWeekKey(now));
	});

	test('/attack against a rival monster hits harder, scores for the faction and counts for quests', async () => {
		// mobs[0] is Margaretha's; a Cerberon member is its rival
		await Monster.create(mobs[0]);
		const player = await makePlayer('FA1', { level: 3, totalAttack: 100000, faction: 'Ironmind' });
		const rec = recorder();
		await executeAttack({
			member: { id: 'FA1' },
			guild: { id: G },
			user: { id: 'FA1' },
			channel: { send: async () => undefined },
			deferReply: async () => undefined,
			editReply: async (payload) => rec.push('editReply', payload),
		}, { delay: noWait });

		const final = rec.calls.at(-1)[1].embeds[0].data;
		assert.match(final.title, /rival: Dawnguard/);
		assert.match(final.fields[0].value, /\+1 for Ironmind this week/);
		assert.equal((await FactionScore.findOne({ where: { guildID: G, faction: 'Cerberon' } })).score, 1);
		assert.ok(await QuestProgress.count({ where: { accountID: player.accountID } }) >= 1);
	});
});
