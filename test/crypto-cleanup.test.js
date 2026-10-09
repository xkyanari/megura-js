const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Collection } = require('discord.js');
const config = require('./config');
const { sequelize, Shop } = require('../src/db');
const { readTestMode } = require('../src/vars');
const handler = require('../events/InteractionCreate');
const auctionCommand = require('../commands/slash-commands/auction');
const placeBid = require('../components/buttons/placeBid1');
const { collectCommands } = require('../deploy');
const { migrate, PLAYER_COLUMNS } = require('../scripts/migrations/2026-10-remove-crypto');
const { resetDb, closeAll, recorder } = require('./helpers');

// Runs `fn` with auctions switched off, as in production.
const withoutAuctions = async (fn) => {
	config.enableAuctions = false;
	try {
		await fn();
	}
	finally {
		config.enableAuctions = true;
	}
};

const interaction = ({ command, button }) => {
	const rec = recorder();
	return {
		rec,
		user: { id: 'U1' },
		member: { id: 'U1' },
		guildId: 'G1',
		guild: { id: 'G1' },
		commandName: command?.data.name,
		customId: button?.data.name,
		client: {
			commands: new Collection(command ? [[command.data.name, command]] : []),
			buttons: new Collection(button ? [[button.data.name, button]] : []),
			cooldown: new Collection(),
		},
		isChatInputCommand: () => Boolean(command),
		isUserContextMenuCommand: () => false,
		isButton: () => Boolean(button),
		isStringSelectMenu: () => false,
		isModalSubmit: () => false,
		isAutocomplete: () => false,
		reply: async (payload) => rec.push('reply', payload),
	};
};

before(async () => {
	await resetDb();
	await sequelize.query('DROP TABLE IF EXISTS `_migrations`');
});
after(closeAll);

describe('auctions are switched off', () => {
	test('/auction and auction buttons answer that the feature is unavailable', async () => {
		await withoutAuctions(async () => {
			for (const target of [{ command: auctionCommand }, { button: placeBid }]) {
				const i = interaction(target);
				await handler.execute(i);
				assert.deepEqual(i.rec.calls, [['reply', { content: 'This feature is currently unavailable.', flags: 64 }]]);
			}
		});
	});

	test('/auction isn\'t registered with Discord while switched off', async () => {
		await withoutAuctions(async () => {
			const names = collectCommands().map((command) => command.name);
			assert.ok(!names.includes('auction'));
			assert.ok(names.includes('attack'));
		});
		assert.ok(collectCommands().some((command) => command.name === 'auction'), 'back once enabled');
	});
});

test('test mode reads testMode, or the older isTestnet key', () => {
	assert.equal(readTestMode({ testMode: true }), true);
	assert.equal(readTestMode({ testMode: 'true' }), true);
	assert.equal(readTestMode({ isTestnet: true }), true);
	assert.equal(readTestMode({ testMode: false, isTestnet: true }), false, 'the new key wins');
	assert.equal(readTestMode({ testMode: 'false' }), false);
	assert.equal(readTestMode({}), false);
});

test('the migration drops the NFT columns and moves old shop categories, once', async () => {
	const queryInterface = sequelize.getQueryInterface();
	// an existing database still has the old columns
	await queryInterface.addColumn('Player', 'linked', { type: 'BOOLEAN', defaultValue: 0 });
	for (const column of ['walletAddress', 'contractAddress']) await queryInterface.addColumn('Player', column, { type: 'TEXT' });
	await queryInterface.addColumn('Player', 'tokenID', { type: 'INTEGER' });
	await Shop.bulkCreate(['whitelist', 'nfts', 'crypto', 'events'].map((category, i) => ({
		itemName: `Item ${i}`, item_ID: `item${i}`, category, price: 10, quantity: 1, guildID: 'G1',
	})));

	const logs = [];
	await migrate({ dryRun: true, log: (line) => logs.push(line) });
	assert.match(logs.join('\n'), /Move 3 shop item/);
	assert.ok(PLAYER_COLUMNS.every((column) => column in (sequelize.models.Player.rawAttributes ?? {}) === false));

	await migrate({ log: () => undefined });
	const columns = Object.keys(await queryInterface.describeTable('Player'));
	for (const column of PLAYER_COLUMNS) assert.ok(!columns.includes(column), `${column} dropped`);
	assert.deepEqual((await Shop.findAll({ where: { guildID: 'G1' }, order: [['item_ID', 'ASC']] })).map((s) => s.category), ['digital', 'digital', 'digital', 'events']);

	const again = [];
	await migrate({ log: (line) => again.push(line) });
	assert.match(again.join('\n'), /already been applied/);
});

// replaces the earlier 25-item cap: categories now page 10 items at a time, like the global shop
test('a 30-item special-shop category pages 10 / 10 / 10, with select options for each page', async () => {
	const { EventEmitter } = require('node:events');
	const category = require('../components/menus/specialshopCategory');
	await Shop.bulkCreate(Array.from({ length: 30 }, (_, i) => ({
		itemName: `Perk ${i}`, item_ID: `perk${i}`, category: 'digital', price: 1, quantity: 1, level: i, guildID: 'BIG',
	})));
	const rec = recorder();
	const collector = Object.assign(new EventEmitter(), { resetTimer: () => undefined });
	const message = {
		createMessageComponentCollector: () => collector,
		edit: async (payload) => rec.push('edit', payload),
	};
	await category.execute({
		values: ['digital'],
		guild: { id: 'BIG' },
		user: { id: 'U1' },
		client: { emojis: { cache: { get: () => null } } },
		deferReply: async (options) => rec.push('deferReply', options),
		editReply: async (payload) => {
			rec.push('editReply', payload);
			return message;
		},
	});
	assert.equal(rec.calls[0][1].flags, 64);
	const check = (payload, page) => {
		const embed = payload.embeds[0].data;
		const options = payload.components[0].components[0].options.map((o) => o.data.label);
		assert.equal(embed.fields.length, 10);
		assert.match(embed.description, new RegExp(`Page ${page} of 3`));
		assert.deepEqual(options, embed.fields.map((f) => f.name.replace(/__\*\*(.*)\*\*__/, '$1')));
		assert.equal(options[0], `Perk ${(page - 1) * 10}`);
	};
	check(rec.calls.at(-1)[1], 1);

	for (const page of [2, 3]) {
		const done = new Promise((resolve) => {
			message.edit = async (payload) => resolve(payload);
		});
		collector.emit('collect', { user: { id: 'U1' }, customId: 'next', deferUpdate: async () => undefined });
		check(await done, page);
	}
});

test('an empty special-shop category says so', async () => {
	const category = require('../components/menus/specialshopCategory');
	const rec = recorder();
	await category.execute({
		values: ['events'],
		guild: { id: 'EMPTY' },
		client: { emojis: { cache: { get: () => null } } },
		deferReply: async () => undefined,
		editReply: async (payload) => rec.push('editReply', payload),
	});
	assert.equal(rec.calls.at(-1)[1], 'Nothing in this category yet.');
});
