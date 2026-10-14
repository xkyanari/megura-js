const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const redis = require('../redis');
const handler = require('../events/InteractionCreate');
const { resetDb, closeAll, recorder } = require('./helpers');

// A slash-command interaction that records replies and enforces discord.js's reply rules.
const commandInteraction = (command, { userId = 'U1', options, autocomplete = false } = {}) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		user: { id: userId },
		member: { id: userId },
		guildId: 'G1',
		guild: { id: 'G1' },
		commandName: command.data.name,
		client: { commands: new Collection([[command.data.name, command]]), cooldown: new Collection() },
		options,
		isChatInputCommand: () => !autocomplete,
		isUserContextMenuCommand: () => false,
		isButton: () => false,
		isStringSelectMenu: () => false,
		isModalSubmit: () => false,
		isAutocomplete: () => autocomplete,
		async reply(payload) {
			if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
			this.replied = true;
			rec.push('reply', payload);
		},
		async deferReply(payload) {
			this.deferred = true;
			rec.push('defer', payload);
		},
		async editReply(payload) { rec.push('editReply', payload); },
		async followUp(payload) { rec.push('followUp', payload); },
	};
};

// Silences console.error for expected failures.
const quietly = async (fn) => {
	const original = console.error;
	console.error = () => undefined;
	try {
		await fn();
	}
	finally {
		console.error = original;
	}
};

before(resetDb);
beforeEach(() => redis.flushdb());
after(closeAll);

test('every command and component module loads', () => {
	for (const dir of ['commands/slash-commands', 'components/buttons', 'components/menus', 'components/modals']) {
		const full = path.join(__dirname, '..', dir);
		for (const file of fs.readdirSync(full).filter((f) => f.endsWith('.js'))) {
			assert.doesNotThrow(() => require(path.join(full, file)), file);
		}
	}
});

test('an error after deferReply edits the deferred reply and clears the cooldown', async () => {
	const boom = {
		data: { name: 'boom' },
		cooldown: 60000,
		async execute(interaction) {
			await interaction.deferReply();
			throw new Error('kaboom');
		},
	};
	const interaction = commandInteraction(boom);

	await quietly(() => handler.execute(interaction));

	assert.deepEqual(interaction.rec.kinds(), ['defer', 'editReply']);
	assert.equal(await redis.get('U1:G1:boom'), null);
});

test('"profile not found" before any reply sends the /start hint', async () => {
	const noProfile = {
		data: { name: 'np' },
		cooldown: 1000,
		async execute() { throw new Error('profile not found'); },
	};
	const interaction = commandInteraction(noProfile);

	await handler.execute(interaction);

	assert.equal(interaction.rec.kinds()[0], 'reply');
	assert.match(interaction.rec.content(0), /\/start/);
	assert.equal(interaction.rec.calls[0][1].flags, 64);
});

test('a successful command keeps its cooldown', async () => {
	const ok = {
		data: { name: 'ok' },
		cooldown: 60000,
		async execute(interaction) { await interaction.reply({ content: 'hi' }); },
	};

	await handler.execute(commandInteraction(ok));
	const second = commandInteraction(ok);
	await handler.execute(second);

	assert.match(second.rec.content(0), /cooldown/);
});

test('autocomplete errors are not answered with a reply', async () => {
	const ac = {
		data: { name: 'ac' },
		cooldown: 0,
		async autocomplete() { throw new Error('x'); },
	};
	const interaction = commandInteraction(ac, { autocomplete: true });

	await quietly(() => handler.execute(interaction));

	assert.equal(interaction.rec.calls.length, 0);
});
