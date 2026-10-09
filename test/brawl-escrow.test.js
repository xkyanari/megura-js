// Mainnet behaviour: stakes are escrowed in the guild wallet.
require('./config').testMode = false;

const { test } = require('node:test');
const assert = require('node:assert');
const { Brawl } = require('../src/db');
const W = require('../functions/brawlWager');

const { G, ores, brawlRow } = require('./brawl-wager')(1);

test('a challenger without enough ores cannot open a listing', async () => {
	await assert.rejects(
		W.openBrawl({ listingId: 'b4', challengerId: 'P', guildID: G, wager: 6 }),
		/insufficient funds/,
	);
	assert.equal(await Brawl.count({ where: { listingId: 'b4' } }), 0);
});

test('an acceptor without enough ores is refused and nothing moves', async () => {
	await W.openBrawl({ listingId: 'b5', challengerId: 'C', guildID: G, wager: 20 });
	assert.deepEqual(await W.acceptBrawl('b5', 'P', G), { ok: false, reason: 'insufficient funds' });
	assert.equal(await ores('P'), 5);
	assert.equal((await brawlRow('b5')).acceptorId, null);
});
