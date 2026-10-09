const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura, Guild, FactionConfig, FactionSeason } = require('../src/db');
const { addFactionPoint, pointsThisWeek, standings } = require('../functions/factions');
const S = require('../functions/factionSeason');
const { previousWeekKey } = require('../functions/period');
const { resetDb, closeAll } = require('./helpers');

const DAY = 24 * 60 * 60 * 1000;
// Monday 12 October 2026, 00:05 UTC: the job settles the week of 5 October
const MONDAY = Date.UTC(2026, 9, 12, 0, 5);
const LAST_WEEK = MONDAY - 3 * DAY;

const makePlayer = async (guildID, discordID, level = 1) => {
	const player = await Player.create({ discordID, guildID, playerName: discordID, level });
	await Iura.create({ accountID: player.accountID, walletAmount: 0, walletName: `w${guildID}${discordID}`, bankName: `b${guildID}${discordID}` });
	return player;
};
const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;
const score = async (guildID, faction, player, times) => {
	for (let i = 0; i < times; i++) await addFactionPoint(guildID, faction, LAST_WEEK, player.accountID);
};

// A guild whose members and roles are recorded instead of changed.
const fakeClient = (guildID) => {
	const changes = [];
	const sent = [];
	const member = (id) => ({ roles: { add: async () => changes.push(['add', id]), remove: async () => changes.push(['remove', id]) } });
	const guild = {
		roles: { fetch: async (id) => ({ id }) },
		members: { fetch: async (id) => (id === 'LEFT' ? Promise.reject(new Error('Unknown Member')) : member(id)) },
	};
	return {
		changes,
		sent,
		guilds: { fetch: async (id) => (id === guildID ? guild : Promise.reject(new Error('Unknown Guild'))) },
		channels: { fetch: async () => ({ send: async (payload) => sent.push(payload) }) },
	};
};

before(resetDb);
after(closeAll);

describe('points', () => {
	test('every point counts, even when they land at once', async () => {
		const player = await makePlayer('GP', 'P1');
		await Promise.all(Array.from({ length: 10 }, () => addFactionPoint('GP', 'Cerberon', LAST_WEEK, player.accountID)));
		assert.equal((await standings('GP', LAST_WEEK)).thisWeek.Cerberon, 10);
		assert.equal(await pointsThisWeek('GP', player.accountID, LAST_WEEK), 10);
	});
});

describe('settling a week', () => {
	test('the winning side\'s scorers are paid by level and points, once', async () => {
		await Guild.create({ guildID: 'GS', margarethaName: 'Dawnguard', cerberonName: 'Ironmind' });
		const top = await makePlayer('GS', 'TOP', 10);
		const helper = await makePlayer('GS', 'HELPER', 10);
		const rival = await makePlayer('GS', 'RIVAL', 10);
		await score('GS', 'Margaretha', top, 4);
		await score('GS', 'Margaretha', helper, 2);
		await score('GS', 'Cerberon', rival, 5);

		const result = await S.settleSeason('GS', previousWeekKey(MONDAY));
		assert.equal(result.winner, 'Margaretha');
		assert.deepEqual(result.scores, { Margaretha: 6, Cerberon: 5 });
		assert.equal(await walletOf(top), S.SEASON_IURA_PER_LEVEL * 10);
		assert.equal(await walletOf(helper), Math.round(S.SEASON_IURA_PER_LEVEL * 10 * 0.75));
		assert.equal(await walletOf(rival), 0);

		assert.equal(await S.settleSeason('GS', previousWeekKey(MONDAY)), null, 'a week is settled once');
		assert.equal(await walletOf(top), S.SEASON_IURA_PER_LEVEL * 10);
	});

	test('a tie has no winner and pays nobody', async () => {
		const a = await makePlayer('GT', 'A');
		const b = await makePlayer('GT', 'B');
		await score('GT', 'Margaretha', a, 3);
		await score('GT', 'Cerberon', b, 3);
		const result = await S.settleSeason('GT', previousWeekKey(MONDAY));
		assert.equal(result.winner, null);
		assert.deepEqual(result.rewards, []);
		assert.equal((await walletOf(a)) + (await walletOf(b)), 0);
	});
});

describe('the weekly job', () => {
	test('announces the result and moves the champion role to the new winners', async () => {
		const winner = await makePlayer('GJ', 'NEW');
		await score('GJ', 'Cerberon', winner, 1);
		await FactionConfig.create({ guildID: 'GJ', channelID: 'C', roleID: 'R' });
		await FactionSeason.create({ guildID: 'GJ', weekKey: 'w:2000-W01', winner: 'Margaretha', rewardedIDs: ['OLD', 'LEFT', 'NEW'] });

		const client = fakeClient('GJ');
		const results = await S.runSeasonJob(client, MONDAY);
		assert.ok(results.some((result) => result.guildID === 'GJ' && result.winner === 'Cerberon'));
		assert.deepEqual(client.changes, [['remove', 'OLD'], ['add', 'NEW']], 'members who left are skipped; staying winners keep it');
		assert.match(client.sent[0].embeds[0].data.description, /\*\*Cerberon\*\* wins the week/);

		const again = fakeClient('GJ');
		await S.runSeasonJob(again, MONDAY);
		assert.deepEqual([again.changes, again.sent], [[], []], 'nothing happens twice');
	});
});
