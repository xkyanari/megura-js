// Live behaviour: IURA stakes leave the players' wallets until the brawl settles.
require('./config').testMode = false;

const { test } = require('node:test');
const assert = require('node:assert');
const { Player, Guild, Brawl } = require('../src/db');
const W = require('../functions/brawlWager');

const { G, iura, guildWallet, brawlRow } = require('./brawl-wager')(1);

test('a challenger without enough IURA cannot open a listing', async () => {
	await assert.rejects(
		W.openBrawl({ listingId: 'b4', challengerId: 'P', guildID: G, wager: 6 }),
		/insufficient funds/,
	);
	assert.equal(await Brawl.count({ where: { listingId: 'b4' } }), 0);
});

test('an acceptor without enough IURA is refused and nothing moves', async () => {
	await W.openBrawl({ listingId: 'b5', challengerId: 'C', guildID: G, wager: 20 });
	assert.deepEqual(await W.acceptBrawl('b5', 'P', G), { ok: false, reason: 'insufficient funds' });
	assert.equal(await iura('P'), 5);
	assert.equal((await brawlRow('b5')).acceptorId, null);
});

test('a brawl opened in ores before the switch is still refunded and paid in ores', async () => {
	const ores = async (id) => (await Player.findOne({ where: { discordID: id, guildID: G } })).oresEarned;
	// C staked 10 ores before the switch: the stake sits in the guild wallet
	await Player.decrement({ oresEarned: 10 }, { where: { discordID: 'C', guildID: G } });
	await Guild.increment({ walletAmount: 10 }, { where: { guildID: G } });
	await Brawl.create({ listingId: 'old1', challengerId: 'C', wager: 10, currency: 'ores', status: 'pending' });
	const [oresBefore, walletBefore, iuraBefore] = [await ores('A'), await guildWallet(), await iura('A')];

	assert.equal((await W.acceptBrawl('old1', 'A', G)).ok, true);
	assert.equal(await ores('A'), oresBefore - 10, 'the acceptor stakes ores too');
	assert.equal(await iura('A'), iuraBefore, 'no IURA moves');

	assert.equal(await W.settleBrawl('old1', G, 'A'), true);
	assert.equal(await ores('A'), oresBefore + 10);
	assert.equal(await guildWallet(), walletBefore - 10);
	assert.equal(await iura('A'), iuraBefore);
});

test('the migration marks existing brawls as ores and new ones default to IURA', async () => {
	const { migrate } = require('../scripts/migrations/2026-10-brawl-iura');
	const { sequelize } = require('../src/db');
	await sequelize.query('DELETE FROM `_migrations` WHERE `name` = \'2026-10-brawl-iura\'').catch(() => undefined);
	// a database from before the switch has no currency column
	await sequelize.getQueryInterface().removeColumn('Brawl', 'currency');

	await migrate({ log: () => undefined });
	const [rows] = await sequelize.query('SELECT DISTINCT `currency` FROM `Brawl`');
	assert.deepEqual(rows.map((row) => row.currency), ['ores']);

	await W.openBrawl({ listingId: 'new1', challengerId: 'C', guildID: G, wager: 1 });
	assert.equal((await brawlRow('new1')).currency, 'iura');
	await sequelize.query('INSERT INTO `Brawl` (`listingId`, `challengerId`, `wager`, `createdAt`, `updatedAt`) VALUES (\'raw1\', \'C\', 1, NOW(), NOW())');
	assert.equal((await brawlRow('raw1')).currency, 'iura', 'the column default is IURA');
});
