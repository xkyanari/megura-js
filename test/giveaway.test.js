const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const Queue = require('bull');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Guild, Giveaway, GiveawayEntry } = require('../src/db');
const handler = require('../events/InteractionCreate');
const giveawayCommand = require('../commands/slash-commands/giveaway');
const enterButton = require('../components/buttons/giveaway-enter');
const G = require('../functions/giveaway');
const { resetDb, closeAll, recorder } = require('./helpers');

const queue = new Queue(`giveawayTest${Date.now()}`, redisURL);

// A channel that records posts and lets the bot edit what it posted.
const fakeChannel = (id) => {
	const posted = [];
	const edits = [];
	const channel = {
		id,
		posted,
		edits,
		send: async (payload) => {
			const message = { id: `M${posted.length + 1}`, payload, edit: async (p) => { edits.push(p); } };
			posted.push(message);
			return message;
		},
		messages: { fetch: async (messageId) => posted.find((m) => m.id === messageId) ?? null },
	};
	return channel;
};

const makeClient = (channels) => ({
	commands: new Collection([['giveaway', giveawayCommand]]),
	buttons: new Collection([['giveaway-enter', enterButton]]),
	cooldown: new Collection(),
	giveawayQueue: queue,
	channels: { fetch: async (id) => channels.find((c) => c.id === id) ?? null },
});

const interactionBase = (client, { guildId = 'GA', userId = 'HOST' } = {}) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		client,
		user: { id: userId, tag: `${userId}#0001` },
		member: { id: userId },
		guildId,
		guild: { id: guildId },
		isChatInputCommand: () => false,
		isUserContextMenuCommand: () => false,
		isButton: () => false,
		isStringSelectMenu: () => false,
		isModalSubmit: () => false,
		isAutocomplete: () => false,
		async reply(payload) {
			if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
			this.replied = true;
			rec.push('reply', payload);
		},
		async deferReply(payload) {
			if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
			this.deferred = true;
			rec.push('defer', payload);
		},
		async editReply(payload) { rec.push('editReply', payload); },
		async followUp(payload) { rec.push('followUp', payload); },
	};
};

const runCommand = async (client, subcommand, { strings = {}, integers = {}, channel, here, guildId = 'GA' } = {}) => {
	// each test runs several commands back to back: clear the 3s cooldown and the
	// anti-spam counter (flushing Redis would also wipe the live Bull queue)
	await redis.del(`HOST:${guildId}:giveaway`, `counter:HOST:${guildId}`);
	const interaction = interactionBase(client, { guildId });
	Object.assign(interaction, {
		commandName: 'giveaway',
		channel: here,
		isChatInputCommand: () => true,
		options: {
			getSubcommand: () => subcommand,
			getString: (name) => strings[name] ?? null,
			getInteger: (name) => integers[name] ?? null,
			getChannel: () => channel ?? null,
		},
	});
	await handler.execute(interaction);
	return interaction;
};

const clickEnter = async (client, giveawayId, userId) => {
	const interaction = interactionBase(client, { userId });
	Object.assign(interaction, { customId: `giveaway-enter:${giveawayId}`, isButton: () => true });
	await handler.execute(interaction);
	return interaction.rec.content(0);
};

const newGiveaway = (overrides = {}) => G.createGiveaway({
	guildID: 'GA', channelID: 'C1', hostID: 'HOST', prize: 'Nitro', winnerCount: 1,
	endsAt: new Date(Date.now() + 60 * 60 * 1000), ...overrides,
});

const enter = (giveaway, users) => Promise.all(users.map((u) => GiveawayEntry.create({ giveawayId: giveaway.id, userId: u })));

before(async () => {
	await resetDb();
	await Guild.create({ guildID: 'GA', subscription: 'premium' });
	await Guild.create({ guildID: 'GF', subscription: 'free' });
});
after(async () => {
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('engine', () => {
	test('pickWinners draws distinct winners and honours exclusions', () => {
		for (let i = 0; i < 50; i++) {
			const winners = G.pickWinners(['a', 'b', 'c', 'd', 'a'], 3, ['b']);
			assert.equal(winners.length, 3);
			assert.equal(new Set(winners).size, 3);
			assert.ok(!winners.includes('b'));
		}
		assert.deepEqual(G.pickWinners(['a'], 3), ['a']);
		assert.deepEqual(G.pickWinners([], 2), []);
	});

	test('entering twice leaves; a finished giveaway refuses entries', async () => {
		const giveaway = await newGiveaway();
		assert.deepEqual(await G.toggleEntry(giveaway.id, 'U1'), { ok: true, entered: true, count: 1 });
		assert.deepEqual(await G.toggleEntry(giveaway.id, 'U2'), { ok: true, entered: true, count: 2 });
		assert.deepEqual(await G.toggleEntry(giveaway.id, 'U1'), { ok: true, entered: false, count: 1 });

		const expired = await newGiveaway({ endsAt: new Date(Date.now() - 1000) });
		assert.deepEqual(await G.toggleEntry(expired.id, 'U1'), { ok: false, reason: 'closed' });
	});

	test('ten simultaneous ends draw exactly once', async () => {
		const giveaway = await newGiveaway({ winnerCount: 2 });
		await enter(giveaway, ['U1', 'U2', 'U3', 'U4']);

		const results = await Promise.all(Array.from({ length: 10 }, () => G.endGiveaway(giveaway.id)));
		const drawn = results.filter(Boolean);
		assert.equal(drawn.length, 1);
		assert.equal(drawn[0].winners.length, 2);
		assert.equal(drawn[0].entrantCount, 4);
		assert.deepEqual((await Giveaway.findByPk(giveaway.id)).winners, drawn[0].winners);
	});

	test('fewer entrants than winners, and no entrants at all', async () => {
		const few = await newGiveaway({ winnerCount: 5 });
		await enter(few, ['U1', 'U2']);
		assert.deepEqual((await G.endGiveaway(few.id)).winners.sort(), ['U1', 'U2']);

		const empty = await newGiveaway();
		const result = await G.endGiveaway(empty.id);
		assert.deepEqual(result.winners, []);
		assert.equal(result.entrantCount, 0);
	});

	test('reroll never repeats a winner and needs an ended giveaway', async () => {
		const giveaway = await newGiveaway();
		await enter(giveaway, ['U1', 'U2', 'U3']);
		assert.equal(await G.rerollGiveaway(giveaway.id), null, 'still running');

		const { winners: [first] } = await G.endGiveaway(giveaway.id);
		const { winners: [second] } = await G.rerollGiveaway(giveaway.id);
		const { winners: [third] } = await G.rerollGiveaway(giveaway.id);
		assert.equal(new Set([first, second, third]).size, 3);
		assert.deepEqual((await G.rerollGiveaway(giveaway.id)).winners, [], 'everyone has won');
		assert.deepEqual((await Giveaway.findByPk(giveaway.id)).winners, [first, second, third]);
	});

	test('a cancelled giveaway cannot be ended or cancelled again', async () => {
		const giveaway = await newGiveaway();
		assert.equal((await G.cancelGiveaway(giveaway.id)).status, 'cancelled');
		assert.equal(await G.cancelGiveaway(giveaway.id), null);
		assert.equal(await G.endGiveaway(giveaway.id), null);
	});
});

describe('/giveaway command and Enter button', () => {
	test('start posts the giveaway and schedules its end', async () => {
		const here = fakeChannel('HERE');
		const client = makeClient([here]);
		const interaction = await runCommand(client, 'start', { strings: { prize: 'Rare sword', duration: '2h' }, integers: { winners: 2 }, here });

		assert.match(interaction.rec.content(1), /Giveaway \*\*#(\d+)\*\* started/);
		const giveaway = await Giveaway.findOne({ where: { prize: 'Rare sword' } });
		assert.equal(giveaway.winnerCount, 2);
		assert.equal(giveaway.messageID, here.posted[0].id);
		assert.equal(here.posted[0].payload.components[0].components[0].data.custom_id, `giveaway-enter:${giveaway.id}`);

		const job = await queue.getJob(`giveaway-${giveaway.id}`);
		assert.ok(job, 'end is scheduled');
		assert.ok(Math.abs(job.opts.delay - 2 * 60 * 60 * 1000) < 5000);
	});

	test('start rejects a bad duration without creating anything', async () => {
		const client = makeClient([]);
		const countBefore = await Giveaway.count();
		for (const duration of ['soon', '10s', '31d']) {
			const interaction = await runCommand(client, 'start', { strings: { prize: 'x', duration }, here: fakeChannel('H') });
			assert.match(interaction.rec.content(0), /between 1 minute and 30 days/, duration);
		}
		assert.equal(await Giveaway.count(), countBefore);
	});

	test('a giveaway that cannot be posted is not left running', async () => {
		const blocked = { id: 'BLOCKED', send: async () => { throw new Error('Missing Access'); } };
		const client = makeClient([]);
		const original = console.error;
		console.error = () => undefined;
		await runCommand(client, 'start', { strings: { prize: 'Ghost prize', duration: '1h' }, here: blocked }).finally(() => { console.error = original; });

		assert.equal(await Giveaway.count({ where: { prize: 'Ghost prize' } }), 0);
	});

	test('the free tier is refused', async () => {
		const interaction = await runCommand(makeClient([]), 'list', { guildId: 'GF' });
		assert.match(interaction.rec.calls[0][1].embeds[0].data.description, /not available in your current version/);
	});

	test('members enter and leave with the button; end announces the winner', async () => {
		const here = fakeChannel('C2');
		const client = makeClient([here]);
		await runCommand(client, 'start', { strings: { prize: 'Badge', duration: '1h' }, here });
		const giveaway = await Giveaway.findOne({ where: { prize: 'Badge' } });

		assert.match(await clickEnter(client, giveaway.id, 'P1'), /You're in! 1 entry/);
		assert.match(await clickEnter(client, giveaway.id, 'P2'), /You're in! 2 entries/);
		assert.match(await clickEnter(client, giveaway.id, 'P2'), /left the giveaway. 1 entry/);

		const ended = await runCommand(client, 'end', { integers: { id: giveaway.id } });
		assert.match(ended.rec.content(0), /ended/);
		assert.equal(await queue.getJob(`giveaway-${giveaway.id}`), null, 'scheduled end removed');

		const announcement = here.posted.at(-1).payload;
		assert.match(announcement.content, /Congratulations <@P1>! You won \*\*Badge\*\*/);
		assert.deepEqual(announcement.allowedMentions, { users: ['P1'] });
		assert.equal(here.edits.at(-1).components[0].components[0].data.disabled, true, 'button disabled');

		assert.match(await clickEnter(client, giveaway.id, 'P3'), /has ended/);
		const again = await runCommand(client, 'end', { integers: { id: giveaway.id } });
		assert.match(again.rec.content(0), /isn't running/);
	});

	test('another server\'s giveaway can\'t be touched', async () => {
		const other = await newGiveaway({ guildID: 'OTHER' });
		const interaction = await runCommand(makeClient([]), 'cancel', { integers: { id: other.id } });
		assert.match(interaction.rec.content(0), new RegExp(`no giveaway #${other.id} in this server`));
		assert.equal((await Giveaway.findByPk(other.id)).status, 'running');
	});

	test('the scheduled job ends the giveaway', async () => {
		const here = fakeChannel('C3');
		const giveaway = await newGiveaway({ channelID: 'C3', prize: 'Job prize' });
		await enter(giveaway, ['J1']);

		assert.equal(await G.processGiveawayJob(makeClient([here]), { giveawayId: giveaway.id }), true);
		assert.match(here.posted.at(-1).payload.content, /<@J1>/);
		assert.equal(await G.processGiveawayJob(makeClient([here]), { giveawayId: giveaway.id }), false, 'second run is a no-op');
	});
});
