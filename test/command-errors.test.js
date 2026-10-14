// Commands used to catch their own errors and only log them, leaving the user with no reply.
// Errors now reach events/InteractionCreate.js, which always answers.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { Player, Iura } = require('../src/db');
const handler = require('../events/InteractionCreate');
const { resetDb, closeAll, recorder } = require('./helpers');

const commandInteraction = (command, { userId = 'U1', options = {} } = {}) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		user: { id: userId, tag: 'user' },
		member: { id: userId, displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
		guildId: 'G1',
		guild: { id: 'G1' },
		commandName: command.data.name,
		client: { commands: new Collection([[command.data.name, command]]), cooldown: new Collection() },
		options: { getString: () => null, getInteger: () => null, ...options },
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
			this.deferred = true;
			rec.push('defer', payload);
		},
		async editReply(payload) { rec.push('editReply', payload); },
		async followUp(payload) { rec.push('followUp', payload); },
	};
};

const lastText = (interaction) => {
	const [, payload] = interaction.rec.calls.at(-1);
	return typeof payload === 'string' ? payload : payload.content || payload.embeds?.[0]?.data?.description || '';
};

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

for (const name of ['inventory', 'equip', 'unequip']) {
	test(`/${name} without a profile shows the /start hint`, async () => {
		const command = require(`../commands/slash-commands/${name}`);
		const interaction = commandInteraction(command, { options: { getString: () => 'sword', getInteger: () => 1 } });

		await handler.execute(interaction);

		assert.ok(interaction.rec.calls.length > 0, 'the user got a reply');
		assert.match(lastText(interaction), /\/start/);
	});
}

test('a command that fails mid-way answers with the error embed and clears its cooldown', async () => {
	const daily = require('../commands/slash-commands/daily');
	const player = await Player.create({ discordID: 'D1', guildID: 'G1' });
	await Iura.create({ accountID: player.accountID, walletAmount: 0 });
	const interaction = commandInteraction(daily, { userId: 'D1' });

	// no quests in the table, so /daily fails while building its embed
	await quietly(() => handler.execute(interaction));

	assert.match(lastText(interaction), /Error executing `daily`/);
	assert.equal(await redis.get('D1:G1:daily'), null, 'the 24h cooldown was not kept');
	assert.equal((await Iura.findByPk(player.accountID)).walletAmount, 0, 'no reward was paid');
});
