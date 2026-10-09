/**
 * Shared brawl escrow checks, run by brawl-escrow.test.js (real ores move)
 * and brawl-testnet.test.js (no ores move). `moves` is 1 or 0 accordingly.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Guild, Brawl } = require('../src/db');
const W = require('../functions/brawlWager');
const { resetDb, closeAll } = require('./helpers');

module.exports = (moves) => {
	const G = 'G1';
	const ores = async (id) => (await Player.findOne({ where: { discordID: id, guildID: G } })).oresEarned;
	const guildWallet = async () => (await Guild.findOne({ where: { guildID: G } })).walletAmount;
	const brawlRow = async (listingId) => (await Brawl.findOne({ where: { listingId } })).toJSON();

	before(async () => {
		await resetDb();
		await Guild.create({ guildID: G, walletAmount: 1000 });
		for (const [id, amount] of [['C', 100], ['A', 100], ['P', 5]]) {
			await Player.create({ discordID: id, guildID: G, oresEarned: amount });
		}
		for (let i = 0; i < 10; i++) {
			await Player.create({ discordID: `X${i}`, guildID: G, oresEarned: 100 });
		}
	});

	after(closeAll);

	test('win: the winner takes both stakes and the guild wallet nets to zero', async () => {
		await W.openBrawl({ listingId: 'b1', challengerId: 'C', guildID: G, wager: 30 });
		assert.equal(await ores('C'), 100 - 30 * moves);
		assert.equal(await guildWallet(), 1000 + 30 * moves);

		assert.deepEqual(await W.acceptBrawl('b1', 'C', G), { ok: false, reason: 'self' });
		assert.equal((await W.acceptBrawl('b1', 'A', G)).ok, true);
		assert.equal(await guildWallet(), 1000 + 60 * moves);

		assert.equal(await W.expireBrawl('b1', G), false, 'an accepted brawl cannot expire');
		assert.equal(await W.settleBrawl('b1', G, 'A'), true);
		assert.equal(await W.settleBrawl('b1', G, 'A'), false, 'settles only once');
		assert.equal(await W.settleBrawl('b1', G, null), false, 'a late timeout job is a no-op');

		assert.equal(await ores('A'), 100 + 30 * moves);
		assert.equal(await ores('C'), 100 - 30 * moves);
		assert.equal(await guildWallet(), 1000);
		assert.equal((await brawlRow('b1')).outcome, 'acceptor_win');
		assert.equal((await brawlRow('b1')).wager, 30, 'wager is the per-player stake');
	});

	test('draw (settle timeout job) refunds both players', async () => {
		await W.openBrawl({ listingId: 'b2', challengerId: 'C', guildID: G, wager: 20 });
		await W.acceptBrawl('b2', 'A', G);
		await W.processBrawlJob({ type: 'settle', listingId: 'b2', guildID: G });

		assert.equal(await ores('A'), 100 + 30 * moves);
		assert.equal(await ores('C'), 100 - 30 * moves);
		assert.equal(await guildWallet(), 1000);
		assert.equal((await brawlRow('b2')).outcome, 'draw');
	});

	test('expiry refunds the challenger once and closes the listing', async () => {
		await W.openBrawl({ listingId: 'b3', challengerId: 'C', guildID: G, wager: 10 });
		assert.equal(await W.processBrawlJob({ type: 'expire', listingId: 'b3', guildID: G }), true);
		assert.equal(await W.expireBrawl('b3', G), false);

		assert.equal(await ores('C'), 100 - 30 * moves);
		assert.equal(await guildWallet(), 1000);
		assert.deepEqual(await W.acceptBrawl('b3', 'A', G), { ok: false, reason: 'not open' });
	});

	test('a listing id cannot be reused', async () => {
		await assert.rejects(
			W.openBrawl({ listingId: 'b3', challengerId: 'C', guildID: 'G2', wager: 10 }),
			/duplicate listing/,
		);
		assert.equal(await Brawl.count({ where: { listingId: 'b3' } }), 1);
	});

	test('only one of ten simultaneous accepts gets in', async () => {
		await W.openBrawl({ listingId: 'b6', challengerId: 'C', guildID: G, wager: 40 });
		const before40 = await guildWallet();

		const results = await Promise.all(
			Array.from({ length: 10 }, (_, i) => W.acceptBrawl('b6', `X${i}`, G)),
		);

		assert.equal(results.filter((r) => r.ok).length, 1);
		assert.ok(results.filter((r) => !r.ok).every((r) => r.reason === 'taken'));
		assert.equal(await guildWallet(), before40 + 40 * moves);

		let total = 0;
		for (let i = 0; i < 10; i++) total += await ores(`X${i}`);
		assert.equal(total, 1000 - 40 * moves);
	});

	return { G, ores, brawlRow };
};
