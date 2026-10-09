const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const Queue = require('bull');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Guild, Player, Iura, Raffle, RaffleTicket } = require('../src/db');
const handler = require('../events/InteractionCreate');
const raffleCommand = require('../commands/slash-commands/raffle');
const buyButton = require('../components/buttons/raffle-buy');
const buyModal = require('../components/modals/raffle-buy');
const R = require('../functions/raffle');
const { resetDb, closeAll, recorder } = require('./helpers');

const GUILD = 'RA';
const queue = new Queue(`raffleTest${Date.now()}`, redisURL);

const createMember = async (discordID, { iura = 0, ores = 0 } = {}) => {
	const player = await Player.create({ discordID, guildID: GUILD, oresEarned: ores });
	await Iura.create({ accountID: player.accountID, walletAmount: iura });
	return player;
};
const iuraOf = async (discordID) => {
	const player = await Player.findOne({ where: { discordID, guildID: GUILD } });
	return (await Iura.findByPk(player.accountID)).walletAmount;
};
const oresOf = async (discordID) => (await Player.findOne({ where: { discordID, guildID: GUILD } })).oresEarned;
const guildWallet = async () => (await Guild.findOne({ where: { guildID: GUILD } })).walletAmount;
const ticketsOf = async (raffleId, userId) => (await RaffleTicket.findOne({ where: { raffleId, userId } }))?.count ?? 0;

const newRaffle = (overrides = {}) => R.createRaffle({
	guildID: GUILD, channelID: 'C1', hostID: 'HOST', prize: 'Prize', winnerCount: 1,
	currency: 'iura', ticketPrice: 10, maxTicketsPerUser: 10,
	endsAt: new Date(Date.now() + 60 * 60 * 1000), ...overrides,
});

before(async () => {
	await resetDb();
	await Guild.create({ guildID: GUILD, subscription: 'premium', walletAmount: 0 });
	await Guild.create({ guildID: 'RF', subscription: 'free' });
});
after(async () => {
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('weighted draw', () => {
	test('draws distinct members, skips excluded and ticketless ones', () => {
		const tickets = [{ userId: 'a', count: 1 }, { userId: 'b', count: 3 }, { userId: 'c', count: 0 }, { userId: 'd', count: 2 }];
		for (let i = 0; i < 50; i++) {
			const winners = R.pickWeightedWinners(tickets, 5, ['d']);
			assert.deepEqual(winners.slice().sort(), ['a', 'b']);
		}
	});

	test('more tickets means a proportionally better chance', () => {
		const tickets = [{ userId: 'heavy', count: 9 }, { userId: 'light', count: 1 }];
		let heavyWins = 0;
		for (let i = 0; i < 2000; i++) {
			if (R.pickWeightedWinners(tickets, 1)[0] === 'heavy') heavyWins++;
		}
		// expected 90%; allow wide margins so the test never flakes
		assert.ok(heavyWins > 1650 && heavyWins < 1950, `heavy won ${heavyWins} of 2000`);
	});
});

describe('buying tickets', () => {
	test('IURA tickets are paid from the wallet', async () => {
		await createMember('I1', { iura: 100 });
		const raffle = await newRaffle();
		assert.deepEqual(await R.buyTickets(raffle.id, 'I1', GUILD, 3), { ok: true, held: 3, cost: 30, currency: 'iura' });
		assert.equal(await iuraOf('I1'), 70);
		assert.equal(await ticketsOf(raffle.id, 'I1'), 3);
	});

	test('ore tickets go to the server wallet', async () => {
		await createMember('O1', { ores: 50 });
		const raffle = await newRaffle({ currency: 'ores', ticketPrice: 5 });
		const walletBefore = await guildWallet();
		assert.equal((await R.buyTickets(raffle.id, 'O1', GUILD, 4)).cost, 20);
		assert.equal(await oresOf('O1'), 30);
		assert.equal(await guildWallet(), walletBefore + 20);
	});

	test('insufficient funds, no profile, the cap, and a closed raffle change nothing', async () => {
		await createMember('P1', { iura: 25 });
		const raffle = await newRaffle({ maxTicketsPerUser: 5 });
		assert.deepEqual(await R.buyTickets(raffle.id, 'P1', GUILD, 3), { ok: false, reason: 'insufficient funds' });
		assert.deepEqual(await R.buyTickets(raffle.id, 'NOBODY', GUILD, 1), { ok: false, reason: 'profile' });
		assert.equal((await R.buyTickets(raffle.id, 'P1', GUILD, 2)).ok, true);
		assert.deepEqual(await R.buyTickets(raffle.id, 'P1', GUILD, 4), { ok: false, reason: 'cap', held: 2, max: 5 });
		assert.equal(await iuraOf('P1'), 5);

		const ended = await newRaffle({ endsAt: new Date(Date.now() - 1000) });
		assert.deepEqual(await R.buyTickets(ended.id, 'P1', GUILD, 1), { ok: false, reason: 'closed' });
		assert.deepEqual(await R.buyTickets(raffle.id, 'P1', 'ANOTHER-SERVER', 1), { ok: false, reason: 'closed' });
		assert.equal(await iuraOf('P1'), 5);
	});

	test('ten simultaneous purchases never overshoot the cap or overcharge', async () => {
		await createMember('C1', { iura: 1000 });
		const raffle = await newRaffle({ maxTicketsPerUser: 10, ticketPrice: 7 });
		const results = await Promise.all(Array.from({ length: 10 }, () => R.buyTickets(raffle.id, 'C1', GUILD, 3)));
		const bought = results.filter((r) => r.ok).length;
		assert.equal(bought, 3, '3 x 3 tickets fit under the cap of 10');
		assert.ok(results.filter((r) => !r.ok).every((r) => r.reason === 'cap'));
		assert.equal(await ticketsOf(raffle.id, 'C1'), 9);
		assert.equal(await iuraOf('C1'), 1000 - 9 * 7);
	});
});

describe('ending and cancelling', () => {
	test('ten simultaneous ends draw once; reroll never repeats a winner', async () => {
		const raffle = await newRaffle();
		await RaffleTicket.bulkCreate([
			{ raffleId: raffle.id, userId: 'W1', count: 1 },
			{ raffleId: raffle.id, userId: 'W2', count: 2 },
			{ raffleId: raffle.id, userId: 'W3', count: 3 },
		]);

		const results = (await Promise.all(Array.from({ length: 10 }, () => R.endRaffle(raffle.id)))).filter(Boolean);
		assert.equal(results.length, 1);
		assert.equal(results[0].ticketCount, 6);
		assert.equal(results[0].entrantCount, 3);

		const first = results[0].winners[0];
		const second = (await R.rerollRaffle(raffle.id)).winners[0];
		const third = (await R.rerollRaffle(raffle.id)).winners[0];
		assert.equal(new Set([first, second, third]).size, 3);
		assert.deepEqual((await R.rerollRaffle(raffle.id)).winners, []);
	});

	test('cancelling refunds every ticket in both currencies, once', async () => {
		await createMember('R1', { iura: 100 });
		await createMember('R2', { ores: 100 });
		const iuraRaffle = await newRaffle({ ticketPrice: 10 });
		const oreRaffle = await newRaffle({ currency: 'ores', ticketPrice: 4 });
		await R.buyTickets(iuraRaffle.id, 'R1', GUILD, 5);
		await R.buyTickets(oreRaffle.id, 'R2', GUILD, 5);
		const walletBefore = await guildWallet();

		assert.deepEqual(
			(({ refunded, unrefunded }) => ({ refunded, unrefunded }))(await R.cancelRaffle(iuraRaffle.id)),
			{ refunded: 1, unrefunded: 0 },
		);
		await R.cancelRaffle(oreRaffle.id);
		assert.equal(await iuraOf('R1'), 100);
		assert.equal(await oresOf('R2'), 100);
		assert.equal(await guildWallet(), walletBefore - 20);

		assert.equal(await R.cancelRaffle(iuraRaffle.id), null, 'second cancel is a no-op');
		assert.equal(await R.endRaffle(iuraRaffle.id), null, 'a cancelled raffle cannot be drawn');
		assert.equal(await iuraOf('R1'), 100, 'refunded only once');
	});

	test('a member who reset their profile is counted, not refunded', async () => {
		const member = await createMember('GONE', { iura: 50 });
		const raffle = await newRaffle();
		await R.buyTickets(raffle.id, 'GONE', GUILD, 2);
		await Iura.destroy({ where: { accountID: member.accountID } });
		await member.destroy();

		const result = await R.cancelRaffle(raffle.id);
		assert.deepEqual([result.refunded, result.unrefunded], [0, 1]);
		assert.equal(result.raffle.status, 'cancelled');
	});
});

describe('/raffle command, buy button and form', () => {
	const fakeChannel = (id) => {
		const posted = [];
		const edits = [];
		return {
			id, posted, edits,
			send: async (payload) => {
				const message = { id: `M${posted.length + 1}`, payload, edit: async (p) => { edits.push(p); } };
				posted.push(message);
				return message;
			},
			messages: { fetch: async (messageId) => posted.find((m) => m.id === messageId) ?? null },
		};
	};
	const makeClient = (channels) => ({
		commands: new Collection([['raffle', raffleCommand]]),
		buttons: new Collection([['raffle-buy', buyButton]]),
		modals: new Collection([['raffle-buy', buyModal]]),
		cooldown: new Collection(),
		raffleQueue: queue,
		channels: { fetch: async (id) => channels.find((c) => c.id === id) ?? null },
	});
	const base = (client, { userId = 'HOST', guildId = GUILD } = {}) => {
		const rec = recorder();
		return {
			rec, client, deferred: false, replied: false,
			user: { id: userId, tag: `${userId}#0001` }, member: { id: userId },
			guildId, guild: { id: guildId },
			isChatInputCommand: () => false, isUserContextMenuCommand: () => false, isButton: () => false,
			isStringSelectMenu: () => false, isModalSubmit: () => false, isAutocomplete: () => false,
			async reply(p) {
				if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
				this.replied = true;
				rec.push('reply', p);
			},
			async deferReply(p) {
				if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
				this.deferred = true;
				rec.push('defer', p);
			},
			async editReply(p) { rec.push('editReply', p); },
			async followUp(p) { rec.push('followUp', p); },
			async showModal(m) { rec.push('modal', m); },
		};
	};
	const command = async (client, subcommand, { strings = {}, integers = {}, here, guildId = GUILD } = {}) => {
		await redis.del(`HOST:${guildId}:raffle`, `counter:HOST:${guildId}`);
		const interaction = Object.assign(base(client, { guildId }), {
			commandName: 'raffle', channel: here, isChatInputCommand: () => true,
			options: {
				getSubcommand: () => subcommand,
				getString: (n) => strings[n] ?? null,
				getInteger: (n) => integers[n] ?? null,
				getChannel: () => null,
			},
		});
		await handler.execute(interaction);
		return interaction;
	};

	test('start → Buy tickets → form → end, with the winner announced', async () => {
		await createMember('BUYER', { iura: 100 });
		const here = fakeChannel('RC');
		const client = makeClient([here]);

		await command(client, 'start', { strings: { prize: 'Gold role', duration: '1h', currency: 'iura' }, integers: { price: 15, max_tickets: 4 }, here });
		const raffle = await Raffle.findOne({ where: { prize: 'Gold role' } });
		assert.ok(await queue.getJob(`raffle-${raffle.id}`), 'end scheduled');
		assert.equal(here.posted[0].payload.components[0].components[0].data.custom_id, `raffle-buy:${raffle.id}`);

		const click = Object.assign(base(client, { userId: 'BUYER' }), { customId: `raffle-buy:${raffle.id}`, isButton: () => true });
		await handler.execute(click);
		assert.equal(click.rec.kinds()[0], 'modal');
		assert.equal(click.rec.calls[0][1].data.custom_id, `raffle-buy:${raffle.id}`);

		const submit = (quantity) => Object.assign(base(client, { userId: 'BUYER' }), {
			customId: `raffle-buy:${raffle.id}`, isModalSubmit: () => true,
			fields: { getTextInputValue: () => quantity },
		});
		const bad = submit('two');
		await handler.execute(bad);
		assert.match(bad.rec.content(0), /whole number/);

		const good = submit('3');
		await handler.execute(good);
		assert.match(good.rec.content(0), /Bought 3 tickets for 45 IURA. You now hold 3/);

		const over = submit('2');
		await handler.execute(over);
		assert.match(over.rec.content(0), /at most 4 tickets.*already have 3/);

		await command(client, 'end', { integers: { id: raffle.id } });
		assert.match(here.posted.at(-1).payload.content, /Congratulations <@BUYER>! You won \*\*Gold role\*\*/);
		assert.equal(await queue.getJob(`raffle-${raffle.id}`), null, 'scheduled end removed');
		assert.equal(await iuraOf('BUYER'), 55);
	});

	test('the free tier is refused', async () => {
		const interaction = await command(makeClient([]), 'list', { guildId: 'RF' });
		assert.match(interaction.rec.calls[0][1].embeds[0].data.description, /not available in your current version/);
	});
});
