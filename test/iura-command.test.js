const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura } = require('../src/db');
const iura = require('../commands/slash-commands/iura');
const { resetDb, closeAll, recorder, noop } = require('./helpers');

// Runs /iura <subcommand> with the given integer options and returns what it replied.
const run = async (subcommand, ints) => {
	const rec = recorder();
	await iura.execute({
		member: { id: 'X' },
		guild: { id: 'G1' },
		options: {
			getString: () => null,
			getInteger: (name) => ints[name] ?? null,
			getSubcommand: () => subcommand,
		},
		deferReply: noop,
		async editReply(payload) { rec.push('editReply', payload); },
	});
	return rec;
};

let player;

const balances = async () => {
	const row = await Iura.findByPk(player.accountID);
	return [row.walletAmount, row.bankAmount, row.stakedAmount];
};

before(async () => {
	await resetDb();
	player = await Player.create({ discordID: 'X', guildID: 'G1' });
	await Iura.create({ accountID: player.accountID, walletAmount: 100, bankAmount: 0, stakedAmount: 0 });
});

after(closeAll);

test('wallet deposit moves wallet -> bank', async () => {
	await run('wallet', { deposit: 60 });
	assert.deepEqual(await balances(), [40, 60, 0]);
});

test('bank save moves bank -> savings', async () => {
	await run('bank', { save: 50 });
	assert.deepEqual(await balances(), [40, 10, 50]);
});

test('bank take moves savings -> bank', async () => {
	await run('bank', { take: 20 });
	assert.deepEqual(await balances(), [40, 30, 30]);
});

test('wallet withdraw moves bank -> wallet without minting', async () => {
	await run('wallet', { withdraw: 30 });
	assert.deepEqual(await balances(), [70, 0, 30]);
});

test('withdrawing more than the bank holds is refused', async () => {
	const rec = await run('wallet', { withdraw: 1 });
	assert.match(rec.content(0), /sufficient/);
	assert.deepEqual(await balances(), [70, 0, 30]);
});
