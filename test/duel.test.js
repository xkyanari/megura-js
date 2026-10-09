const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura } = require('../src/db');
const { duel_expGained } = require('../src/vars');
const D = require('../functions/duel');
const { resetDb, closeAll, recorder } = require('./helpers');

const GUILD = 'GD';

const createPlayer = async (discordID, wallet, extra = {}) => {
	const player = await Player.create({ discordID, guildID: GUILD, totalHealth: 1000, ...extra });
	await Iura.create({
		accountID: player.accountID,
		walletAmount: wallet,
		walletName: `w${player.accountID}`,
		bankName: `b${player.accountID}`,
	});
	return player;
};

const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;

const fakeInteraction = (userId) => {
	const rec = recorder();
	return {
		rec,
		user: { id: userId },
		guild: { id: GUILD },
		client: { user: { id: 'BOT' } },
		reply: async (p) => rec.push('reply', p),
		deferReply: async (p) => rec.push('defer', p),
		editReply: async (p) => rec.push('editReply', p),
	};
};

before(resetDb);
after(closeAll);

describe('duel payout', () => {
	test('the winner takes 40% of the loser\'s wallet as it is at the end, rounded down', async () => {
		const winner = await createPlayer('W1', 500);
		const loser = await createPlayer('L1', 1000);
		// the loser spent most of their wallet during the battle
		await Iura.update({ walletAmount: 333 }, { where: { accountID: loser.accountID } });

		const amount = await D.settleDuel({ winner, loser, challengerWon: true });
		assert.equal(amount, 133, 'floor(333 × 0.4), not 40% of the stale 1000');
		assert.equal(await walletOf(loser), 200);
		assert.equal(await walletOf(winner), 633);

		await winner.reload();
		assert.equal(winner.iuraEarned, 133);
		assert.equal(winner.expGained, duel_expGained);
		assert.equal(winner.duelKills, 1);
	});

	test('a challenger who loses pays, and gets no rewards; an empty wallet pays nothing', async () => {
		const challenger = await createPlayer('C2', 250);
		const target = await createPlayer('T2', 100);
		assert.equal(await D.settleDuel({ winner: target, loser: challenger, challengerWon: false }), 100);
		assert.equal(await walletOf(challenger), 150);
		assert.equal(await walletOf(target), 200);
		await challenger.reload();
		assert.equal(challenger.duelKills, 0);

		await Iura.update({ walletAmount: 0 }, { where: { accountID: challenger.accountID } });
		assert.equal(await D.settleDuel({ winner: target, loser: challenger, challengerWon: false }), 0);
		assert.equal(await walletOf(challenger), 0);
	});

	test('two duels settling against the same loser at once never overdraw', async () => {
		const loser = await createPlayer('L3', 1000);
		const a = await createPlayer('A3', 0);
		const b = await createPlayer('B3', 0);

		const amounts = await Promise.all([
			D.settleDuel({ winner: a, loser, challengerWon: true }),
			D.settleDuel({ winner: b, loser, challengerWon: true }),
		]);
		assert.deepEqual(amounts.sort((x, y) => x - y), [240, 400], '40% of 1000, then 40% of what was left');
		assert.equal(await walletOf(loser), 360);
		assert.equal((await walletOf(a)) + (await walletOf(b)), 640, 'no IURA created or lost');
	});
});

describe('duel checks', () => {
	test('refuses missing profiles, rank gaps and thin wallets', async () => {
		await createPlayer('ME', 500);
		await createPlayer('RICH', 500, { totalHealth: 1000 + D.MAX_HEALTH_GAP });
		await createPlayer('POOR', 99);
		await createPlayer('OK', 100);
		const load = async (a, b) => Object.values(await D.loadDuelists(GUILD, a, b));
		const [me, rich] = await load('ME', 'RICH');
		const [, poor] = await load('ME', 'POOR');
		const [, ok] = await load('ME', 'OK');
		const targetUser = { tag: 'Someone#0001' };

		assert.match(D.duelRefusal(me, null, targetUser), /Someone#0001 does not have a voyager profile/);
		assert.match(D.duelRefusal(me, rich, targetUser), /rank is inappropriate/);
		assert.match(D.duelRefusal(me, poor, targetUser), /not have enough balance/);
		assert.match(D.duelRefusal(poor, ok, targetUser), /at least \$100/);
		assert.equal(D.duelRefusal(me, ok, targetUser), null);

		assert.equal(ok.iura.walletAmount, 100);
		assert.equal((await D.loadDuelists(GUILD, 'ME', 'NOBODY')).target, null);
	});

	test('runDuel answers for itself, the bot, bots and a target without a profile', async () => {
		const self = fakeInteraction('ME');
		await D.runDuel(self, { id: 'ME' });
		assert.match(self.rec.content(0), /cannot allow that/);

		const bot = fakeInteraction('ME');
		await D.runDuel(bot, { id: 'BOT' });
		assert.match(bot.rec.content(0), /don't engage in battles/);

		const otherBot = fakeInteraction('ME');
		await D.runDuel(otherBot, { id: 'X', bot: true });
		assert.match(otherBot.rec.content(0), /cannot duel with bots/);

		// the "Request for Duel" menu passes a User: this used to crash on player2.user.tag
		const noProfile = fakeInteraction('ME');
		await D.runDuel(noProfile, { id: 'NOBODY', tag: 'Nobody#0001', username: 'nobody' });
		assert.match(noProfile.rec.content(1), /Nobody#0001 does not have a voyager profile/);

		const noOwnProfile = fakeInteraction('GHOST');
		await assert.rejects(D.runDuel(noOwnProfile, { id: 'ME' }), /profile not found/);
	});
});
