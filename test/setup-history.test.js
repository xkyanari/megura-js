const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { Guild } = require('../src/db');
const handler = require('../events/InteractionCreate');
const setup = require('../commands/slash-commands/setup');
const { readRecentLogs } = require('../functions/logs');
const { resetDb, closeAll, recorder } = require('./helpers');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const G = 'HIST1';

const removeGuildLogs = (guildId) => {
	if (!fs.existsSync(LOG_DIR)) return;
	for (const file of fs.readdirSync(LOG_DIR)) {
		if (file.startsWith(`guildID${guildId}_`)) fs.unlinkSync(path.join(LOG_DIR, file));
	}
};

// A text channel that records what the bot posts to it.
const postingChannel = (id, name) => {
	const sent = [];
	return { id, name, sent, send: async (payload) => { sent.push(payload); } };
};

const setupInteraction = (subcommand, { options = {}, channels = [] } = {}) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		user: { id: 'ADMIN', tag: 'admin#0001' },
		member: { id: 'ADMIN' },
		guildId: G,
		guild: { id: G },
		commandName: 'setup',
		client: {
			commands: new Collection([['setup', setup]]),
			cooldown: new Collection(),
			channels: {
				cache: new Collection(channels.map((c) => [c.id, c])),
				fetch: async () => null,
			},
		},
		options: {
			getSubcommand: () => subcommand,
			getChannel: () => options.channel,
			getRole: (name) => options.roles?.[name],
			getString: (name) => options.strings?.[name] ?? null,
			getInteger: (name) => options.integers?.[name] ?? null,
			getBoolean: () => null,
		},
		isChatInputCommand: () => true,
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

before(async () => {
	await resetDb();
	await Guild.create({ guildID: G });
	removeGuildLogs(G);
	removeGuildLogs('HIST12');
});
beforeEach(() => redis.flushdb());
after(async () => {
	removeGuildLogs(G);
	removeGuildLogs('HIST12');
	await closeAll();
});

test('readRecentLogs returns the newest entries first, across days, for that server only', async () => {
	fs.mkdirSync(LOG_DIR, { recursive: true });
	fs.writeFileSync(path.join(LOG_DIR, `guildID${G}_2000-01-01.log`), 'old 1\nold 2\n');
	fs.writeFileSync(path.join(LOG_DIR, `guildID${G}_2000-01-02.log`), 'new 1\nnew 2\n');
	// a server whose ID starts with the same characters must not leak in
	fs.writeFileSync(path.join(LOG_DIR, 'guildIDHIST12_2000-01-03.log'), 'other server\n');

	assert.deepEqual(await readRecentLogs(G, 3), ['new 2', 'new 1', 'old 2']);
	assert.deepEqual(await readRecentLogs('NO-SUCH-GUILD', 5), []);

	removeGuildLogs(G);
});

test('a setup change is written to history even without a logs channel', async () => {
	const verify = { id: 'VERIFY', name: 'verify' };
	const role = { id: 'ROLE', name: 'Verified' };
	await handler.execute(setupInteraction('captcha', {
		options: { channel: verify, roles: { role }, strings: { type: 'captcha' } },
	}));

	const [latest] = await readRecentLogs(G, 1);
	assert.match(latest, /^<\d{4}-\d\d-\d\dT[^>]+> : admin#0001 \(ADMIN\) changed the CAPTCHA settings/);
	assert.match(latest, /#verify \(VERIFY\)/);
	assert.match(latest, /@Verified \(ROLE\)/);
});

test('/setup logs posts that change, and later ones, to the logs channel', async () => {
	const logs = postingChannel('LOGS', 'audit-logs');
	await handler.execute(setupInteraction('logs', { options: { channel: logs }, channels: [logs] }));

	assert.equal(logs.sent.length, 1);
	assert.equal(logs.sent[0].embeds[0].data.title, 'Setup: set the logs channel');

	const role = (id, name) => ({ id, name });
	await handler.execute(setupInteraction('factions', {
		options: { roles: { margaretha: role('M', 'Margaretha'), cerberon: role('C', 'Cerberon') } },
		channels: [logs],
	}));
	// factions needs the hasRoles flag; on the free tier it's refused and nothing is logged
	assert.equal(logs.sent.length, 1);
});

test('a reset is logged before it clears the logs channel', async () => {
	const logs = postingChannel('LOGS', 'audit-logs');
	await handler.execute(setupInteraction('disable', { channels: [logs] }));

	assert.equal(logs.sent.length, 1);
	assert.equal(logs.sent[0].embeds[0].data.title, 'Setup: reset all server configuration');
	assert.equal((await Guild.findOne({ where: { guildID: G } })).logsChannelID, '');
});

test('/setup history lists recent entries newest first', async () => {
	const interaction = setupInteraction('history', { options: { integers: { count: 2 } } });
	await handler.execute(interaction);

	const [kind, payload] = interaction.rec.calls[0];
	assert.equal(kind, 'reply');
	assert.equal(payload.flags, 64);
	const lines = payload.embeds[0].data.description.split('\n');
	assert.equal(lines.length, 2);
	assert.match(lines[0], /^<t:\d+:f> admin#0001 \(ADMIN\) reset all server configuration$/);
	assert.match(lines[1], /set the logs channel/);
});
