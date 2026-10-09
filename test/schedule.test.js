const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const Queue = require('bull');
const { Collection, ChannelType, GuildScheduledEventEntityType, PermissionFlagsBits } = require('discord.js');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Guild, ScheduledPost } = require('../src/db');
const handler = require('../events/InteractionCreate');
const scheduleCommand = require('../commands/slash-commands/schedule');
const S = require('../functions/schedule');
const { resetDb, closeAll, recorder } = require('./helpers');

const GUILD = 'GS';
const FREE = 'GSFREE';
const queue = new Queue(`scheduleTest${Date.now()}`, redisURL);

const fakeChannel = (id, { canPost = true, type = ChannelType.GuildText } = {}) => {
	const posted = [];
	return {
		id,
		name: id.toLowerCase(),
		type,
		posted,
		permissionsFor: () => ({ has: () => canPost }),
		send: async (payload) => { posted.push(payload); return { id: `M${posted.length}` }; },
	};
};

const makeWorld = (channels = []) => {
	const events = [];
	const guildFor = (id, { manageEvents = true } = {}) => ({
		id,
		members: { me: { permissions: { has: (flag) => manageEvents && flag === PermissionFlagsBits.ManageEvents } } },
		scheduledEvents: {
			create: async (options) => { events.push(options); return { name: options.name, url: `https://discord.com/events/${id}/E${events.length}` }; },
		},
	});
	const client = {
		commands: new Collection([['schedule', scheduleCommand]]),
		cooldown: new Collection(),
		scheduleQueue: queue,
		channels: { fetch: async (id) => channels.find((c) => c.id === id) ?? null },
	};
	return { client, events, guildFor };
};

const runCommand = async (world, group, subcommand, { strings = {}, integers = {}, channel, guildId = GUILD, manageEvents } = {}) => {
	await redis.del(`ADMIN:${guildId}:schedule`, `counter:ADMIN:${guildId}`);
	const rec = recorder();
	const interaction = {
		rec,
		deferred: false,
		replied: false,
		client: world.client,
		user: { id: 'ADMIN', tag: 'ADMIN#0001' },
		member: { id: 'ADMIN' },
		guildId,
		guild: world.guildFor(guildId, { manageEvents }),
		commandName: 'schedule',
		isChatInputCommand: () => true,
		isUserContextMenuCommand: () => false,
		isButton: () => false,
		isStringSelectMenu: () => false,
		isModalSubmit: () => false,
		isAutocomplete: () => false,
		options: {
			getSubcommandGroup: () => group,
			getSubcommand: () => subcommand,
			getString: (name) => strings[name] ?? null,
			getInteger: (name) => integers[name] ?? null,
			getChannel: () => channel ?? null,
		},
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
	return typeof payload === 'string' ? payload : payload.content ?? payload.embeds?.[0]?.data?.description;
};

const repeatableFor = async (postId) => (await queue.getRepeatableJobs()).find((job) => job.id === `post-${postId}`);

before(async () => {
	await resetDb();
	await Guild.create({ guildID: GUILD, subscription: 'enterprise' });
	await Guild.create({ guildID: FREE, subscription: 'premium' });
});
after(async () => {
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('schedule engine', () => {
	test('cron checks: 5 fields, valid, at most every 10 minutes', () => {
		const now = new Date('2026-10-09T00:00:00Z');
		assert.equal(S.checkCron('0 9 * * 1', 'UTC', now).next.toISOString(), '2026-10-12T09:00:00.000Z');
		assert.equal(S.checkCron('0 9 * * 1', 'Asia/Manila', now).next.toISOString(), '2026-10-12T01:00:00.000Z');
		assert.equal(S.checkCron('*/10 * * * *', 'UTC', now).ok, true);
		assert.equal(S.checkCron('*/5 * * * *', 'UTC', now).ok, false);
		assert.equal(S.checkCron('0 * * * * *', 'UTC', now).ok, false, 'no seconds field');
		assert.equal(S.checkCron('banana', 'UTC', now).ok, false);
	});

	test('intervals are 10 minutes to 30 days', () => {
		assert.deepEqual(S.parseEvery('6h'), { ok: true, minutes: 360 });
		assert.equal(S.parseEvery('9m').ok, false);
		assert.equal(S.parseEvery('31d').ok, false);
		assert.equal(S.parseEvery('soon').ok, false);
	});

	test('event times: local dates across daylight saving, and delays', () => {
		assert.equal(S.parseWhen('2026-10-20 18:30', 'Asia/Manila').toISOString(), '2026-10-20T10:30:00.000Z');
		assert.equal(S.parseWhen('2026-01-15 12:00', 'America/New_York').toISOString(), '2026-01-15T17:00:00.000Z');
		assert.equal(S.parseWhen('2026-07-15 12:00', 'America/New_York').toISOString(), '2026-07-15T16:00:00.000Z');
		assert.equal(S.parseWhen('2h', 'UTC', 1000).getTime(), 1000 + 2 * 60 * 60 * 1000);
		assert.equal(S.parseWhen('2026-13-01 10:00'), null);
		assert.equal(S.parseWhen('whenever'), null);
	});
});

describe('/schedule post', () => {
	test('add with every and with cron registers repeatable jobs; remove takes them away', async () => {
		const news = fakeChannel('NEWS');
		const world = makeWorld([news]);

		const every = await runCommand(world, 'post', 'add', { channel: news, strings: { message: 'Vote for us!', every: '6h' } });
		assert.match(lastText(every), /Scheduled post \*\*#(\d+)\*\* .* every 6 hours/);
		const hourly = await ScheduledPost.findOne({ where: { content: 'Vote for us!' } });
		assert.equal(hourly.intervalMinutes, 360);
		assert.equal((await repeatableFor(hourly.id)).every, 6 * 60 * 60 * 1000);

		await runCommand(world, 'post', 'add', { channel: news, strings: { message: 'Weekly reset', cron: '0 9 * * 1', timezone: 'Asia/Manila' } });
		const weekly = await ScheduledPost.findOne({ where: { content: 'Weekly reset' } });
		const job = await repeatableFor(weekly.id);
		assert.equal(job.cron, '0 9 * * 1');
		assert.equal(job.tz, 'Asia/Manila');

		const list = await runCommand(world, 'post', 'list');
		assert.match(lastText(list), new RegExp(`#${weekly.id}\\*\\* in <#NEWS> \`0 9 \\* \\* 1\` \\(Asia/Manila\\), next <t:`));

		await runCommand(world, 'post', 'remove', { integers: { id: hourly.id } });
		assert.equal(await ScheduledPost.findByPk(hourly.id), null);
		assert.equal(await repeatableFor(hourly.id), undefined);
		assert.ok(await repeatableFor(weekly.id), 'the other post is untouched');
	});

	test('refusals', async () => {
		const news = fakeChannel('NEWS2');
		const world = makeWorld([news]);
		const add = (strings, extra = {}) => runCommand(world, 'post', 'add', { channel: news, strings: { message: 'hi', ...strings }, ...extra });

		assert.match(lastText(await add({})), /either `every`/);
		assert.match(lastText(await add({ every: '1h', cron: '0 * * * *' })), /either `every`/);
		assert.match(lastText(await add({ every: '1m' })), /between 10 minutes and 30 days/);
		assert.match(lastText(await add({ cron: '* * * * *' })), /at most once every 10 minutes/);
		assert.match(lastText(await add({ every: '1h', timezone: 'Mars/Olympus' })), /isn't a time zone/);
		assert.match(lastText(await add({ every: '1h' }, { channel: fakeChannel('LOCKED', { canPost: false }) })), /can't post in/);
		assert.match(lastText(await add({ every: '1h' }, { guildId: FREE })), /not available in your current version/);
		assert.equal(await ScheduledPost.count({ where: { channelID: ['NEWS2', 'LOCKED'] } }), 0);
		assert.match(lastText(await runCommand(world, 'post', 'remove', { integers: { id: 9999 } })), /no scheduled post/);
	});

	test('a server can have at most 25 scheduled posts', async () => {
		const world = makeWorld();
		await ScheduledPost.bulkCreate(Array.from({ length: S.MAX_POSTS_PER_GUILD }, () => ({
			guildID: 'GSFULL', channelID: 'C', content: 'x', intervalMinutes: 60,
		})));
		await Guild.create({ guildID: 'GSFULL', subscription: 'megura' });
		const reply = await runCommand(world, 'post', 'add', { guildId: 'GSFULL', channel: fakeChannel('C'), strings: { message: 'one more', every: '1h' } });
		assert.match(lastText(reply), /up to 25 scheduled posts/);
		await ScheduledPost.destroy({ where: { guildID: 'GSFULL' } });
	});

	test('posting: sends the message, and pauses a post whose channel is gone', async () => {
		const live = fakeChannel('LIVE');
		const world = makeWorld([live]);
		const post = await ScheduledPost.create({ guildID: GUILD, channelID: 'LIVE', content: 'Daily tip', intervalMinutes: 60 });
		const orphan = await ScheduledPost.create({ guildID: GUILD, channelID: 'DELETED', content: 'lost', intervalMinutes: 60 });
		await S.registerPost(queue, post);
		await S.registerPost(queue, orphan);

		assert.equal(await S.processScheduledPost(world.client, queue, { postId: post.id }), true);
		assert.deepEqual(live.posted, [{ content: 'Daily tip' }]);
		assert.ok((await post.reload()).lastPostedAt);

		assert.equal(await S.processScheduledPost(world.client, queue, { postId: orphan.id }), false);
		assert.equal((await orphan.reload()).enabled, false);
		assert.equal(await repeatableFor(orphan.id), undefined);

		// a job for a post that was deleted removes itself
		await S.registerPost(queue, { id: 424242, intervalMinutes: 60 });
		assert.equal(await S.processScheduledPost(world.client, queue, { postId: 424242 }), false);
		assert.equal(await repeatableFor(424242), undefined);
	});

	test('startup sync registers missing posts and drops stale jobs', async () => {
		const post = await ScheduledPost.create({ guildID: GUILD, channelID: 'X', content: 'sync me', intervalMinutes: 120 });
		const paused = await ScheduledPost.create({ guildID: GUILD, channelID: 'X', content: 'paused', intervalMinutes: 120, enabled: false });
		await S.registerPost(queue, paused);
		await S.registerPost(queue, { id: 777777, intervalMinutes: 30 });

		await S.syncScheduledPosts(queue);
		assert.ok(await repeatableFor(post.id));
		assert.equal(await repeatableFor(paused.id), undefined);
		assert.equal(await repeatableFor(777777), undefined);

		await S.syncScheduledPosts(queue);
		assert.equal((await queue.getRepeatableJobs()).filter((job) => job.id === `post-${post.id}`).length, 1, 'syncing twice adds nothing');
	});
});

describe('/schedule event', () => {
	test('creates an event at a location (default 1h long) or in a voice channel', async () => {
		const world = makeWorld();
		const at = await runCommand(world, 'event', 'create', {
			strings: { name: 'Game night', start: '2099-01-01 20:00', timezone: 'Asia/Manila', location: 'https://twitch.tv/x', description: 'Bring snacks' },
		});
		assert.match(lastText(at), /Created the event \*\*Game night\*\*/);
		const [external] = world.events;
		assert.equal(external.entityType, GuildScheduledEventEntityType.External);
		assert.equal(external.scheduledStartTime.toISOString(), '2099-01-01T12:00:00.000Z');
		assert.equal(external.scheduledEndTime.toISOString(), '2099-01-01T13:00:00.000Z');
		assert.deepEqual(external.entityMetadata, { location: 'https://twitch.tv/x' });

		const stage = fakeChannel('STAGE', { type: ChannelType.GuildStageVoice });
		await runCommand(world, 'event', 'create', { channel: stage, strings: { name: 'AMA', start: '3h' } });
		assert.equal(world.events[1].entityType, GuildScheduledEventEntityType.StageInstance);
		assert.equal(world.events[1].channel, 'STAGE');
	});

	test('refusals', async () => {
		const world = makeWorld();
		const create = (strings, extra = {}) => runCommand(world, 'event', 'create', { strings: { name: 'E', location: 'Park', ...strings }, ...extra });

		assert.match(lastText(await create({ start: '2h' }, { manageEvents: false })), /Manage Events/);
		assert.match(lastText(await create({ start: '2h' }, { channel: fakeChannel('VC', { type: ChannelType.GuildVoice }) })), /not both/);
		assert.match(lastText(await create({ start: '2000-01-01 10:00' })), /start in the future/);
		assert.match(lastText(await create({ start: '2099-01-01 10:00', end: '2099-01-01 09:00' })), /end after it starts/);
		assert.match(lastText(await create({ start: 'later' })), /Give times like/);
		assert.equal(world.events.length, 0);
	});
});
