// /setup logs, mods and shop used to call deferReply twice, which discord.js
// rejects, so they never saved anything. /setup mods and shop (and
// /brawl channel) also left the reply stuck on "thinking..." when the
// webhook couldn't be created.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { Guild } = require('../src/db');
const handler = require('../events/InteractionCreate');
const setup = require('../commands/slash-commands/setup');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'G1';

// A channel whose webhooks can be listed and created, or that refuses to create one.
const webhookChannel = (id, { fail = false } = {}) => ({
	id,
	fetchWebhooks: async () => new Collection(),
	createWebhook: async () => {
		if (fail) throw new Error('Missing Permissions');
		return { id: `W-${id}`, token: `T-${id}` };
	},
});

const setupInteraction = (subcommand, channel) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		user: { id: 'ADMIN' },
		member: { id: 'ADMIN' },
		guildId: G,
		guild: { id: G },
		commandName: 'setup',
		client: {
			commands: new Collection([['setup', setup]]),
			cooldown: new Collection(),
			channels: { cache: new Collection([[channel.id, channel]]), fetch: async () => channel },
		},
		options: { getSubcommand: () => subcommand, getChannel: () => channel },
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

const guildRow = () => Guild.findOne({ where: { guildID: G } });

before(async () => {
	await resetDb();
	await Guild.create({ guildID: G });
});
beforeEach(() => redis.flushdb());
after(closeAll);

test('/setup logs saves the logs channel', async () => {
	const interaction = setupInteraction('logs', { id: 'LOGS' });
	await handler.execute(interaction);

	assert.deepEqual(interaction.rec.kinds(), ['defer', 'editReply']);
	assert.match(interaction.rec.content(1), /Audit Logs channel assigned/);
	assert.equal((await guildRow()).logsChannelID, 'LOGS');
});

test('/setup mods saves the orders channel and its webhook', async () => {
	const interaction = setupInteraction('mods', webhookChannel('MODS'));
	await handler.execute(interaction);

	assert.match(interaction.rec.content(1), /Moderation Logs channel assigned/);
	const guild = await guildRow();
	assert.equal(guild.webhookChannelID, 'MODS');
	assert.equal(guild.webhookId, 'W-MODS');
});

test('/setup shop saves the order-status channel and its webhook', async () => {
	const interaction = setupInteraction('shop', webhookChannel('SHOP'));
	await handler.execute(interaction);

	assert.match(interaction.rec.content(1), /Special Shop announcement channel saved/);
	const guild = await guildRow();
	assert.equal(guild.specialShopChannelID, 'SHOP');
	assert.equal(guild.specialShopWebhookID, 'W-SHOP');
});

test('a webhook that cannot be created gets an error reply, not a stuck "thinking..."', async () => {
	const interaction = setupInteraction('mods', webhookChannel('NOPE', { fail: true }));

	const original = console.error;
	console.error = () => undefined;
	try {
		await handler.execute(interaction);
	}
	finally {
		console.error = original;
	}

	assert.deepEqual(interaction.rec.kinds(), ['defer', 'editReply']);
	assert.match(interaction.rec.calls[1][1].embeds[0].data.description, /Error executing `setup`/);
	assert.equal((await guildRow()).webhookChannelID, 'MODS', 'previous setting kept');
});
