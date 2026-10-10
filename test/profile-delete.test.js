const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Player, Iura, Item, Exploration, QuestProgress, FactionContribution, Order } = require('../src/db');
const { deleteProfile } = require('../functions/deleteProfile');
const command = require('../commands/slash-commands/profile');
const modal = require('../components/modals/profile-delete');
const start = require('../components/modals/start');
const { resetDb, closeAll } = require('./helpers');

before(resetDb);
after(closeAll);

const create = (discordID, guildID = 'G') => Player.create({ discordID, guildID, playerName: 'Voyager' });
const args = (player, extra = {}) => ({ accountID: player.accountID, discordID: player.discordID, guildID: player.guildID, characterName: 'Voyager', confirmation: 'DELETE', ...extra });

test('only the owner in the same server can delete, with both confirmations', async () => {
	const player = await create('owner');
	for (const extra of [{ discordID: 'other' }, { guildID: 'other' }, { characterName: 'Wrong' }, { confirmation: 'delete' }]) {
		assert.equal((await deleteProfile(args(player, extra))).ok, false);
		assert.ok(await Player.findByPk(player.accountID));
	}
});

test('deletes character data, leaves other characters intact and permits /start again', async () => {
	const player = await create('restart');
	const other = await create('restart', 'OTHER');
	await Iura.create({ accountID: player.accountID, walletAmount: 500 });
	await Item.create({ accountID: player.accountID, itemName: 'Simple Rock' });
	await Exploration.create({ accountID: player.accountID, location: 'homestead' });
	await QuestProgress.create({ accountID: player.accountID, periodKey: 'd:2026-10-10', objective: 'kills' });
	await FactionContribution.create({ accountID: player.accountID, guildID: 'G', faction: 'Margaretha', weekKey: 'w:2026-W41', points: 5 });
	assert.deepEqual(await deleteProfile(args(player)), { ok: true });
	for (const model of [Player, Iura, Item, Exploration, QuestProgress, FactionContribution]) {
		assert.equal(await model.count({ where: { accountID: player.accountID } }), 0);
	}
	assert.ok(await Player.findByPk(other.accountID));
	await start.execute({
		member: { id: 'restart' }, guild: { id: 'G' },
		fields: { getTextInputValue: () => 'New Voyager' },
		reply: async () => undefined, followUp: async () => undefined,
	});
	const replacement = await Player.findOne({ where: { discordID: 'restart', guildID: 'G' } });
	assert.equal(replacement.playerName, 'New Voyager');
	assert.notEqual(replacement.accountID, player.accountID);
	assert.deepEqual(await deleteProfile(args(player)), { ok: false, reason: 'missing' });
	assert.ok(await Player.findByPk(replacement.accountID));
});

test('pending shop order prevents deletion until resolved', async () => {
	const player = await create('pending');
	const order = await Order.create({ discordID: 'pending', guildID: 'G', itemName: 'VIP', status: 'pending' });
	assert.deepEqual(await deleteProfile(args(player)), { ok: false, reason: 'pending' });
	assert.ok(await Player.findByPk(player.accountID));
	await order.update({ status: 'completed' });
	assert.deepEqual(await deleteProfile(args(player)), { ok: true });
});

test('/profile delete opens a character-bound modal and submits privately', async () => {
	const player = await create('modal');
	let form;
	await command.execute({
		user: { id: 'modal' }, guild: { id: 'G' },
		options: { getSubcommand: () => 'delete' },
		showModal: async (value) => { form = value.toJSON(); },
	});
	assert.equal(form.custom_id, `profile-delete:${player.accountID}`);
	let reply;
	await modal.execute({
		customId: form.custom_id, user: { id: 'modal' }, guild: { id: 'G' },
		fields: { getTextInputValue: (key) => key === 'characterName' ? 'Voyager' : 'DELETE' },
		deferReply: async (value) => { assert.equal(value.flags, 64); },
		editReply: async (value) => { reply = value.content; },
	});
	assert.match(reply, /permanently deleted/);
	assert.equal(await Player.findByPk(player.accountID), null);
	assert.deepEqual(command.data.toJSON().options.map((option) => option.name), ['view', 'delete']);
});
