const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { Player, Iura, Shop, Guild, transferIura } = require('../src/db');
const { voteWebhook } = require('../functions/vote');
const { resetDb, closeAll } = require('./helpers');

const rejectsWith = (promise, message) => assert.rejects(promise, (error) => error.message === message);

const createPlayer = async (discordID, guildID, wallet) => {
	const player = await Player.create({ discordID, guildID, oresEarned: 100 });
	await Iura.create({
		accountID: player.accountID,
		walletAmount: wallet,
		walletName: `w${player.accountID}`,
		bankName: `b${player.accountID}`,
	});
	return player;
};

const iuraOf = async (player) => (await Iura.findByPk(player.accountID)).toJSON();
const oresOf = async (player) => (await Player.findByPk(player.accountID)).oresEarned;
const guildWallet = async (guildID) => (await Guild.findOne({ where: { guildID } })).walletAmount;

let a;
let b;
let a2;

before(async () => {
	await resetDb();
	a = await createPlayer('A', 'G1', 1000);
	b = await createPlayer('B', 'G1', 0);
	a2 = await createPlayer('A', 'G2', 5);
});

after(closeAll);

test('transferIura moves wallet funds between players', async () => {
	await transferIura(a.accountID, b.accountID, 300);
	assert.equal((await iuraOf(a)).walletAmount, 700);
	assert.equal((await iuraOf(b)).walletAmount, 300);
});

test('transferIura rejects zero, negative and overdrawn amounts', async () => {
	await rejectsWith(transferIura(a.accountID, b.accountID, -50), 'invalid amount');
	await rejectsWith(transferIura(a.accountID, b.accountID, 0), 'invalid amount');
	await rejectsWith(transferIura(a.accountID, b.accountID, 701), 'insufficient funds');
	assert.equal((await iuraOf(a)).walletAmount, 700);
});

test('transferIura rolls back the debit when the recipient is missing', async () => {
	await rejectsWith(transferIura(a.accountID, 99999, 10), 'account not found');
	assert.equal((await iuraOf(a)).walletAmount, 700);
});

test('concurrent transfers never overdraw or lose updates', async () => {
	const results = await Promise.allSettled(
		Array.from({ length: 50 }, () => transferIura(a.accountID, b.accountID, 20)),
	);

	// 700 / 20 = 35 transfers fit
	assert.equal(results.filter((r) => r.status === 'fulfilled').length, 35);
	assert.equal((await iuraOf(a)).walletAmount, 0);
	assert.equal((await iuraOf(b)).walletAmount, 1000);
});

test('deposit and withdraw move between wallet, bank and stake', async () => {
	await b.deposit(400, 'wallet');
	await b.deposit(100, 'bank');
	await b.withdraw(50, 'stake');
	await b.withdraw(200, 'bank');

	const { walletAmount, bankAmount, stakedAmount } = await iuraOf(b);
	assert.deepEqual([walletAmount, bankAmount, stakedAmount], [800, 150, 50]);
});

test('deposit and withdraw refuse to overdraw', async () => {
	await rejectsWith(b.deposit(10000, 'wallet'), 'insufficient funds');
	await rejectsWith(b.withdraw(51, 'stake'), 'insufficient funds');
	await rejectsWith(b.withdraw(5, 'wallet'), 'Unknown withdraw type: wallet');
});

test('spendIura and addIura', async () => {
	await b.spendIura(800);
	await rejectsWith(b.spendIura(1), 'insufficient funds');
	await b.addIura(25);
	assert.equal((await iuraOf(b)).walletAmount, 25);
});

test('vote reward goes to the oldest profile only', async () => {
	await voteWebhook('A', 2);
	assert.equal((await iuraOf(a)).walletAmount, 100);
	assert.equal((await iuraOf(a2)).walletAmount, 5);
});

test('Shop.buyItem charges ores in the current guild only and respects stock', async () => {
	await Guild.create({ guildID: 'G1', walletAmount: 0 });
	await Guild.create({ guildID: 'G2', walletAmount: 0 });
	await Shop.create({ itemName: 'Role', price: 30, quantity: 2, guildID: 'G1' });
	await Shop.create({ itemName: 'Role', price: 30, quantity: 9, guildID: 'G2' });

	await Shop.buyItem('Role', 1, 'A', 'G1');
	await Shop.buyItem('Role', 1, 'A', 'G1');
	await rejectsWith(Shop.buyItem('Role', 1, 'A', 'G1'), 'out of stock');

	assert.equal(await oresOf(a), 40);
	assert.equal(await oresOf(a2), 100, 'other guild profile untouched');
	assert.equal((await Shop.findOne({ where: { guildID: 'G2' } })).quantity, 9, 'other guild shop untouched');
	assert.equal(await guildWallet('G1'), 60);
});

test('Shop.buyItem leaves stock alone when the player cannot pay', async () => {
	await Shop.create({ itemName: 'Pricey', price: 41, quantity: 5, guildID: 'G1' });
	await rejectsWith(Shop.buyItem('Pricey', 1, 'A', 'G1'), 'insufficient funds');
	assert.equal((await Shop.findOne({ where: { itemName: 'Pricey' } })).quantity, 5);
});

test('Shop.returnOres refunds the buyer from the guild wallet', async () => {
	assert.equal(await Shop.returnOres('Role', 1, 'A', 'G1'), 30);
	assert.equal(await oresOf(a), 70);
	assert.equal(await guildWallet('G1'), 30);
});

test('Shop.returnOres keeps the ores in the guild when the buyer has no profile', async () => {
	assert.equal(await Shop.returnOres('Role', 1, 'NOBODY', 'G1'), 0);
	assert.equal(await guildWallet('G1'), 30);
});
