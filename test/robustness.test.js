const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { Guild, Player } = require('../src/db');
const handler = require('../events/InteractionCreate');
const guildDelete = require('../events/GuildDelete');
const setup = require('../commands/slash-commands/setup');
const ranks = require('../commands/slash-commands/ranks');
const invite = require('../commands/slash-commands/invite');
const leveling = require('../functions/level');
const { simulateBattle } = require('../functions/battle');
const { attackPerLevel, defensePerLevel, healthPerLevel, expPoints } = require('../src/vars');
const { startVoteServer } = require('../server');
const { resetDb, closeAll, recorder } = require('./helpers');

const commandInteraction = (command, { guildId, subcommand, userId = 'ADMIN' } = {}) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		user: { id: userId, tag: `${userId}#0001` },
		member: { id: userId },
		guildId,
		guild: guildId ? { id: guildId } : null,
		commandName: command.data.name,
		client: {
			commands: new Collection([[command.data.name, command]]),
			cooldown: new Collection(),
			channels: { cache: new Collection(), fetch: async () => null },
			user: { id: 'BOT' },
		},
		options: {
			getSubcommand: () => subcommand,
			getChannel: () => null,
			getString: () => null,
			getInteger: () => null,
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

before(resetDb);
after(closeAll);

describe('server lifecycle', () => {
	test('removing the bot keeps the server\'s settings', async () => {
		await Guild.create({ guildID: 'KEEP', subscription: 'premium', walletAmount: 1234 });
		await guildDelete.execute({ id: 'KEEP', name: 'Kept', client: { user: { tag: 'Dahlia#0001' }, channels: { fetch: async () => null } } });
		const guild = await Guild.findOne({ where: { guildID: 'KEEP' } });
		assert.equal(guild.subscription, 'premium');
		assert.equal(guild.walletAmount, 1234);
	});

	test('/setup disable works in more than one server (unique twitterID, encrypted tokens)', async () => {
		for (const guildId of ['RESET1', 'RESET2']) {
			await Guild.create({ guildID: guildId, twitterID: `tw-${guildId}` });
			await redis.del(`ADMIN:${guildId}:setup`, `counter:ADMIN:${guildId}`);
			const interaction = commandInteraction(setup, { guildId, subcommand: 'disable' });
			await handler.execute(interaction);
			const guild = await Guild.findOne({ where: { guildID: guildId } });
			assert.equal(guild.twitterID, null, `${guildId} was reset`);
			assert.equal(guild.accessToken, null);
			assert.ok(!interaction.rec.calls.some(([, p]) => p?.embeds?.[0]?.data?.description?.includes('Error executing')));
		}
	});

	test('server-only commands are refused in DMs; DM-safe ones still work', async () => {
		const dm = commandInteraction(ranks, { guildId: null });
		await handler.execute(dm);
		assert.match(dm.rec.content(0), /use this command in a server/);

		const ok = commandInteraction(invite, { guildId: null });
		await handler.execute(ok);
		assert.doesNotMatch(String(ok.rec.content(0) ?? ''), /use this command in a server/);
	});
});

describe('game logic', () => {
	test('leveling adds each stat\'s difference between the old and new level', async () => {
		const start = { level: 3, totalAttack: 1000, totalDefense: 1000, totalHealth: 5000 };
		const player = await Player.create({ discordID: 'LV', guildID: 'GL', ...start, expGained: expPoints(3) + expPoints(4) + 1 });

		const result = await leveling('GL', 'LV');
		assert.deepEqual(result, { level: 5, levelsGained: 2 });
		await player.reload();
		assert.equal(player.expGained, 1);
		assert.equal(player.totalAttack, 1000 + attackPerLevel(5) - attackPerLevel(3));
		assert.equal(player.totalDefense, 1000 + defensePerLevel(5) - defensePerLevel(3));
		assert.equal(player.totalHealth, 5000 + healthPerLevel(5) - healthPerLevel(3));

		// nothing to gain: nothing changes
		assert.deepEqual(await leveling('GL', 'LV'), { level: 5, levelsGained: 0 });
	});

	test('a battle nobody can win ends as a draw, and the log stays within Discord\'s limit', async () => {
		const posted = [];
		let lastEmbed;
		const message = { edit: async ({ embeds }) => { lastEmbed = embeds[0]; } };
		const interaction = {
			channel: {
				send: async (payload) => {
					posted.push(payload);
					if (payload.embeds) lastEmbed = payload.embeds[0];
					return message;
				},
			},
		};
		const tank = (name) => ({ playerName: name, level: 1, totalAttack: 1, totalDefense: 1e9, totalHealth: 100 });

		// battles pause between rounds: skip the waits
		const timers = require('node:timers/promises');
		const realWait = timers.setTimeout;
		timers.setTimeout = async () => undefined;
		try {
			const winner = await simulateBattle(interaction, tank('A'), tank('B'));
			assert.equal(winner, '');
		}
		finally {
			timers.setTimeout = realWait;
		}
		assert.equal(posted.length, 1, 'one battle message, edited each turn');
		assert.match(lastEmbed.data.description, /Both fighters are exhausted\. The battle ends in a draw\./);
		assert.ok(lastEmbed.data.description.length <= 4096);
	});
});

describe('vote server', () => {
	test('starts only with VOTE_PORT, and webhook routes are not rate limited', async () => {
		assert.equal(startVoteServer(undefined), null);
		const server = startVoteServer(0) ?? startVoteServer(39871);
		try {
			const post = () => new Promise((resolve, reject) => {
				const req = http.request({ port: 39871, path: '/top/upvote', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => resolve(res.statusCode));
				req.on('error', reject);
				req.end('{}');
			});
			const codes = [];
			for (let i = 0; i < 30; i++) codes.push(await post());
			assert.ok(codes.every((c) => c === 403), 'unauthorised, but never 429');
		}
		finally {
			await new Promise((resolve) => server.close(resolve));
		}
	});
});
