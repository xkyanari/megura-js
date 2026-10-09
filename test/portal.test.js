const { test, describe, before, after } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const Queue = require('bull');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Guild, Player } = require('../src/db');
const handler = require('../events/InteractionCreate');
const openCommand = require('../commands/slash-commands/open');
const closeCommand = require('../commands/slash-commands/close');
const { findPortalJob, processPortalJob } = require('../functions/portal');
const { resetDb, closeAll, recorder } = require('./helpers');

const queue = new Queue(`portalTest${Date.now()}`, redisURL);

const makeWorld = () => {
	const channels = new Map();
	let created = 0;
	const makeChannel = (id) => {
		const channel = {
			id,
			posted: [],
			deleted: false,
			send: async (p) => { channel.posted.push(p); return { delete: async () => null }; },
			async delete() { this.deleted = true; channels.delete(id); },
		};
		channels.set(id, channel);
		return channel;
	};
	const guildFor = (id) => ({
		id,
		channels: { create: async () => makeChannel(`P${++created}`) },
	});
	const client = {
		user: { id: 'BOT' },
		commands: new Collection([['open', openCommand], ['close', closeCommand]]),
		cooldown: new Collection(),
		deleteChannelQueue: queue,
		channels: { fetch: async (id) => channels.get(id) ?? null },
	};
	makeChannel('LOBBY');
	return { client, channels, guildFor, created: () => created };
};

const run = async (world, commandName, { guildId = 'GP', userId = 'U1', name = 'my-portal' } = {}) => {
	// commands have long cooldowns: clear them between runs
	await redis.del(`${userId}:${guildId}:${commandName}`, `counter:${userId}:${guildId}`);
	const rec = recorder();
	const interaction = {
		rec,
		deferred: false,
		replied: false,
		client: world.client,
		commandName,
		user: { id: userId, tag: `${userId}#0001` },
		member: { id: userId, toString: () => `<@${userId}>` },
		guildId,
		guild: world.guildFor(guildId),
		channel: world.channels.get('LOBBY'),
		isChatInputCommand: () => true,
		isUserContextMenuCommand: () => false,
		isButton: () => false,
		isStringSelectMenu: () => false,
		isModalSubmit: () => false,
		isAutocomplete: () => false,
		options: { getString: () => name },
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
	await handler.execute(interaction);
	return interaction;
};

const lastText = (interaction) => {
	const payload = interaction.rec.calls[interaction.rec.calls.length - 1][1];
	return typeof payload === 'string' ? payload : [payload.content, payload.embeds?.[0]?.data?.description].filter(Boolean).join('\n');
};

// portals need hasRoles, which features-example.json leaves off on every tier
const exampleFeatures = process.env.FEATURES_FILE;
const featuresFile = path.join(os.tmpdir(), `features-portal-${process.pid}.json`);

before(async () => {
	const features = JSON.parse(fs.readFileSync(exampleFeatures, 'utf8'));
	features.free.hasRoles = true;
	fs.writeFileSync(featuresFile, JSON.stringify(features));
	process.env.FEATURES_FILE = featuresFile;

	await resetDb();
	await Guild.create({ guildID: 'GP', subscription: 'free' });
	await Guild.create({ guildID: 'GP2', subscription: 'free' });
	for (const [discordID, guildID] of [['U1', 'GP'], ['U2', 'GP'], ['U1', 'GP2'], ['U3', 'GP']]) {
		await Player.create({ discordID, guildID });
	}
});
after(async () => {
	process.env.FEATURES_FILE = exampleFeatures;
	fs.rmSync(featuresFile, { force: true });
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('/open and /close', () => {
	test('an unregistered server gets the register message, not a crash', async () => {
		const world = makeWorld();
		const result = await run(world, 'open', { guildId: 'NOPE' });
		assert.match(lastText(result), /register the guild/);
		assert.equal(world.created(), 0);
	});

	test('a second /open makes no extra channel, and replies once', async () => {
		const world = makeWorld();
		const first = await run(world, 'open');
		assert.match(lastText(first), /has been opened/);

		const second = await run(world, 'open');
		assert.match(lastText(second), /already have a portal open/);
		assert.deepEqual(second.rec.kinds(), ['defer', 'editReply']);
		assert.equal(world.created(), 1, 'no orphan channel');

		const job = await findPortalJob(queue, 'GP', 'U1');
		assert.equal(job.data.channelId, 'P1');
		await job.remove();
	});

	test('simultaneous /open calls leave exactly one portal', async () => {
		const world = makeWorld();
		await Promise.all([run(world, 'open', { userId: 'U2' }), run(world, 'open', { userId: 'U2' })]);
		const live = [...world.channels.keys()].filter((id) => id.startsWith('P'));
		assert.equal(live.length, 1, 'the extra channel was deleted');
		const job = await findPortalJob(queue, 'GP', 'U2');
		assert.equal(job.data.channelId, live[0]);
		await job.remove();
	});

	test('/close is per server, and reschedules the deletion for 10 seconds', async () => {
		const world = makeWorld();
		await run(world, 'open');
		assert.match(lastText(await run(world, 'close', { guildId: 'GP2' })), /do not have an active portal/);

		const closed = await run(world, 'close');
		assert.match(lastText(closed), /deleted in `10` seconds/);
		const job = await findPortalJob(queue, 'GP', 'U1');
		assert.ok(job.opts.delay <= 10000, 'replaced by a short job');

		assert.equal(await processPortalJob(world.client, job.data), true);
		assert.equal(world.channels.has(job.data.channelId), false);
		assert.match(world.channels.get('LOBBY').posted[0].embeds[0].data.title, /Times Up/);
		await job.remove();
	});

	test('a portal deleted by hand stops blocking /open', async () => {
		const world = makeWorld();
		await run(world, 'open', { userId: 'U3' });
		world.channels.delete('P1');

		assert.match(lastText(await run(world, 'close', { userId: 'U3' })), /vanished/);
		assert.equal(await findPortalJob(queue, 'GP', 'U3'), null);
		assert.match(lastText(await run(world, 'open', { userId: 'U3' })), /has been opened/);
		assert.equal(await processPortalJob(world.client, { channelId: 'GONE' }), false, 'missing channel is not an error');
		await (await findPortalJob(queue, 'GP', 'U3')).remove();
	});
});

describe('transient Discord errors', () => {
	test('a failed fetch that isn\'t Unknown Channel keeps the job and is retried', async () => {
		const flaky = { channels: { fetch: async () => { throw Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }); } } };
		await assert.rejects(processPortalJob(flaky, { channelId: 'P1' }), /socket hang up/);
		const gone = { channels: { fetch: async () => { throw Object.assign(new Error('Unknown Channel'), { code: 10003 }); } } };
		assert.equal(await processPortalJob(gone, { channelId: 'P1' }), false);
	});
});
