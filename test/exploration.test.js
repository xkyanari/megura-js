const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura, Item, Shop, Monster, Exploration } = require('../src/db');
const E = require('../functions/explore');
const { executeAttack } = require('../functions/attack');
const items = require('../assets/item_db.json');
const mobs = require('../assets/mob_db.json');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GX';
const noWait = async () => undefined;

const makePlayer = async (discordID, extra = {}) => {
	const player = await Player.create({ discordID, guildID: G, playerName: discordID, ...extra });
	await Iura.create({ accountID: player.accountID, walletAmount: 0, walletName: `w${discordID}`, bankName: `b${discordID}` });
	return player;
};
const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;
// a random() that returns these values in turn
const sequence = (...values) => {
	let i = 0;
	return () => values[Math.min(i++, values.length - 1)];
};

before(async () => {
	await resetDb();
	await Shop.bulkCreate(items);
	await Monster.bulkCreate(mobs);
});
after(closeAll);

describe('locations', () => {
	test('every monster lives in a known location, and the map opens up with level', () => {
		for (const mob of mobs) assert.ok(E.locationNamed(mob.location), `${mob.location} is in locations.json`);
		assert.deepEqual(E.unlockedFor(1).map((l) => l.name), ['Homestead Ruins', 'Wanderer\'s Trail']);
		assert.equal(E.unlockedFor(100).length, E.LOCATIONS.length);
		assert.equal(E.nextUnlock(1).name, 'Wayfarer\'s Camp');
		assert.equal(E.nextUnlock(100), null);
		assert.equal(E.locationNamed('  timber GROVE ').name, 'Timber Grove');
	});
});

describe('travel', () => {
	test('locked places are refused; the first visit pays a discovery bonus, later ones don\'t', async () => {
		const player = await makePlayer('T1', { level: 6 });
		assert.equal((await E.travel(player.accountID, 'Dahlia\'s Core')).reason, 'locked');
		assert.equal((await E.travel(player.accountID, 'Nowhere')).reason, 'unknown');

		const first = await E.travel(player.accountID, 'Timber Grove');
		assert.deepEqual([first.ok, first.discovered, first.bonus], [true, true, E.DISCOVERY_IURA_PER_LEVEL * 6]);
		assert.equal((await E.travel(player.accountID, 'Timber Grove')).reason, 'here');

		await E.travel(player.accountID, 'Homestead Ruins');
		const back = await E.travel(player.accountID, 'Timber Grove');
		assert.deepEqual([back.discovered, back.bonus], [false, 0]);
		assert.equal(await walletOf(player), E.DISCOVERY_IURA_PER_LEVEL * 6);
		assert.deepEqual((await Exploration.findByPk(player.accountID)).discovered, ['Homestead Ruins', 'Timber Grove']);
	});
});

describe('search', () => {
	// EVENTS weights are item 30, iura 25, lore 20, ambush 15, nothing 10 (of 100)
	test('each kind of find', async () => {
		const player = await makePlayer('S1', { level: 4 });
		const item = await E.search(player, { random: sequence(0.1, 0, 0) });
		assert.equal(item.type, 'item');
		assert.ok(await Item.findOne({ where: { accountID: player.accountID, itemName: item.item } }));

		const iura = await E.search(player, { random: sequence(0.4, 0) });
		assert.deepEqual([iura.type, iura.amount], ['iura', 10 * 4]);
		assert.equal(await walletOf(player), 40);

		assert.equal((await E.search(player, { random: sequence(0.6, 0) })).type, 'lore');
		assert.equal((await E.search(player, { random: sequence(0.8) })).type, 'ambush');
		assert.equal((await E.search(player, { random: sequence(0.95) })).type, 'nothing');
		assert.equal((await Exploration.findByPk(player.accountID)).searches, 5);
	});

	test('a player who never travelled searches the first location', async () => {
		const player = await makePlayer('S2');
		const found = await E.search(player, { random: sequence(0.95) });
		assert.equal(found.location.name, E.START);
	});
});

describe('/attack while exploring', () => {
	test('monsters come from the current location, with its reward bonus', async () => {
		const player = await makePlayer('A1', { level: 15, totalAttack: 1e6 });
		await E.travel(player.accountID, 'Traveler\'s Rest');
		const walletBefore = await walletOf(player);
		const rec = recorder();
		await executeAttack({
			member: { id: 'A1' },
			guild: { id: G },
			user: { id: 'A1' },
			channel: { send: async () => undefined },
			deferReply: async () => undefined,
			editReply: async (payload) => rec.push('editReply', payload),
		}, { delay: noWait, ambush: true });

		const embed = rec.calls.at(-1)[1].embeds[0].data;
		// Volcanic Golem is the only monster at Traveler's Rest
		assert.match(embed.title, /^⚠️ Ambush! A Volcanic Golem attacks!.*· Traveler's Rest$/);
		const golem = mobs.find((mob) => mob.monsterName === 'Volcanic Golem');
		const bonus = E.locationNamed('Traveler\'s Rest').rewardBonus;
		const paid = (await walletOf(player)) - walletBefore;
		assert.ok(paid >= Math.round(golem.iuraDropped * 15 * (1 + bonus)), `paid ${paid}`);
	});
});
