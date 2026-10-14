const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura, Guild, QuestProgress, Exploration } = require('../src/db');
const R = require('../functions/rankings');
const { rankingPages } = require('../commands/slash-commands/ranks');
const profile = require('../functions/profile');
const { addFactionPoint } = require('../functions/factions');
const { dayKey, weekKey, previousWeekKey, thisWeekKeys } = require('../functions/period');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GR';
// Thursday 2026-10-08, 12:00 UTC: this week started on Monday 2026-10-05
const NOW = Date.UTC(2026, 9, 8, 12);
const DAY = 24 * 60 * 60 * 1000;

const makePlayer = async (discordID, extra = {}, guildID = G) => {
	const player = await Player.create({ discordID, guildID, playerName: discordID, ...extra });
	await Iura.create({ accountID: player.accountID, walletAmount: 0, walletName: `w${discordID}${guildID}`, bankName: `b${discordID}${guildID}` });
	return player;
};
const done = (player, periodKey, objective, completed = true) =>
	QuestProgress.create({ accountID: player.accountID, periodKey, objective, progress: 1, completed });

let alice;
let bob;
let other;

before(async () => {
	await resetDb();
	alice = await makePlayer('Alice', { level: 9, iuraEarned: 500 });
	bob = await makePlayer('Bob', { level: 12, iuraEarned: 100 });
	// same person in another server: never on this server's boards
	other = await makePlayer('Alice', { level: 50 }, 'ELSEWHERE');

	await done(alice, dayKey(NOW - 3 * DAY), 'monsterWin'); // Monday
	await done(alice, dayKey(NOW), 'monsterWin');
	await done(alice, weekKey(NOW), 'explore');
	await done(alice, dayKey(NOW), 'duel', false); // not finished
	await done(alice, dayKey(NOW - 4 * DAY), 'loot'); // last Sunday
	await done(alice, previousWeekKey(NOW), 'loot');
	await done(bob, dayKey(NOW), 'monsterWin');
	for (const key of ['d:a', 'd:b', 'd:c', 'd:d']) await done(other, key, 'x');
	await done(other, dayKey(NOW), 'monsterWin');

	await Exploration.create({ accountID: alice.accountID, location: 'Timber Grove', discovered: ['Homestead Ruins', 'Timber Grove'] });
	await Exploration.create({ accountID: bob.accountID, location: 'Homestead Ruins', discovered: ['Homestead Ruins'] });
	await Exploration.create({ accountID: other.accountID, location: 'Homestead Ruins', discovered: ['a', 'b', 'c', 'd'] });

	for (let i = 0; i < 3; i++) await addFactionPoint(G, 'Cerberon', NOW, bob.accountID);
	await addFactionPoint(G, 'Margaretha', NOW, alice.accountID);
	await addFactionPoint(G, 'Margaretha', NOW - 7 * DAY, alice.accountID); // last week
	for (let i = 0; i < 5; i++) await addFactionPoint('ELSEWHERE', 'Margaretha', NOW, other.accountID);
});
after(closeAll);

describe('weeks', () => {
	test('this week is the week\'s own period and each day from Monday through today', () => {
		assert.deepEqual(thisWeekKeys(NOW), ['w:2026-W41', 'd:2026-10-05', 'd:2026-10-06', 'd:2026-10-07', 'd:2026-10-08']);
		assert.deepEqual(thisWeekKeys(Date.UTC(2026, 9, 5)), ['w:2026-W41', 'd:2026-10-05']);
	});
});

describe('/rankings', () => {
	test('quests completed this week, only this server\'s players', async () => {
		assert.deepEqual(await R.topQuestsThisWeek(G, NOW), [{ playerName: 'Alice', value: 3 }, { playerName: 'Bob', value: 1 }]);
	});

	test('places discovered', async () => {
		assert.deepEqual(await R.topDiscoveries(G), [{ playerName: 'Alice', value: 2 }, { playerName: 'Bob', value: 1 }]);
	});

	test('faction points this week', async () => {
		assert.deepEqual(await R.topFactionScorers(G, NOW), [{ playerName: 'Bob', value: 3 }, { playerName: 'Alice', value: 1 }]);
	});

	test('every page, with "Richest" renamed to top earners', async () => {
		const pages = (await rankingPages(G, NOW)).map((page) => page.data);
		assert.deepEqual(pages.map((page) => page.title), [
			'Top 10 Duel Wins:',
			'Top 10 Highest Levels:',
			'Top 10 Monster Kills:',
			'Top 10 Earners (lifetime IURA):',
			'Top 10 Quest Finishers This Week:',
			'Top 10 Explorers:',
			'Top 10 Faction Scorers This Week:',
		]);
		assert.match(pages[1].description, /^1\. \*\*Bob\*\* - Level 12\n2\. \*\*Alice\*\* - Level 9/);
		assert.match(pages[3].description, /^1\. \*\*Alice\*\* - 500 IURA/);
		assert.match(pages[6].description, /^1\. \*\*Bob\*\* - 3 point\(s\)/);
	});

	test('an empty server says so', async () => {
		const pages = await rankingPages('NOBODY', NOW);
		assert.ok(pages.every((page) => page.data.description.startsWith('Nobody yet.')));
	});
});

describe('/profile', () => {
	const view = async (member, viewer) => {
		const rec = recorder();
		await profile({
			guild: { id: G },
			user: { id: viewer.id },
			member: viewer,
			client: { emojis: { cache: { get: () => null } } },
			reply: async (payload) => rec.push('reply', payload),
		}, member, { now: NOW });
		const fields = rec.calls[0][1].embeds[0].data.fields;
		return Object.fromEntries(fields.map((field) => [field.name, field.value]));
	};
	const user = (id) => ({ id, tag: `${id}#0001`, displayAvatarURL: () => 'https://example.com/a.png' });

	test('shows faction, location, and this week\'s quests, discoveries and faction points', async () => {
		await Guild.create({ guildID: G, margarethaID: 'RM', cerberonID: 'RC', margarethaName: 'Dawn', cerberonName: 'Dusk' });
		const fields = await view(user('Alice'), { id: 'Alice', roles: ['RM'] });
		assert.equal(fields['👥 Faction'], 'Dawn');
		assert.equal(fields['🧭 Exploring'], 'Timber Grove');
		assert.equal(fields['🗺️ Places discovered'], '2');
		assert.equal(fields['⚔️ Faction points this week'], '1');
		assert.equal(fields['📜 Quests this week'], '3');
		assert.equal((await alice.reload()).faction, 'Dawn');
	});

	test('someone else\'s profile uses their stored faction; no faction is a Wanderer', async () => {
		const fields = await view(user('Bob'), { id: 'Alice', roles: ['RM'] });
		assert.equal(fields['👥 Faction'], 'Wanderer');
		assert.equal(fields['🧭 Exploring'], 'Homestead Ruins');
		assert.equal(fields['📜 Quests this week'], '1');
		assert.equal(fields['⚔️ Faction points this week'], '3');
	});
});
