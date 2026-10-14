const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Collection, TextInputStyle } = require('discord.js');
const redis = require('../redis');
const { Guild, Form, FormField } = require('../src/db');
const handler = require('../events/InteractionCreate');
const formCommand = require('../commands/slash-commands/form');
const openButton = require('../components/buttons/form-open');
const submitModal = require('../components/modals/form-submit');
const F = require('../functions/form');
const { resetDb, closeAll, recorder } = require('./helpers');

const GUILD = 'GF1';

const fakeChannel = (id, { canPost = true } = {}) => {
	const posted = [];
	return {
		id,
		name: id.toLowerCase(),
		posted,
		permissionsFor: () => ({ has: () => canPost }),
		send: async (payload) => {
			const message = { id: `${id}-M${posted.length + 1}`, payload, deleted: false, async delete() { this.deleted = true; } };
			posted.push(message);
			return message;
		},
		messages: { fetch: async (messageId) => posted.find((m) => m.id === messageId && !m.deleted) ?? null },
	};
};

const makeWorld = (channels) => ({
	commands: new Collection([['form', formCommand]]),
	buttons: new Collection([['form-open', openButton]]),
	modals: new Collection([['form-submit', submitModal]]),
	cooldown: new Collection(),
	channels: { fetch: async (id) => channels.find((c) => c.id === id) ?? null },
});

const guild = { id: GUILD, members: { me: { id: 'BOT' } } };

const interactionBase = (client, userId = 'ADMIN') => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		client,
		user: { id: userId, tag: `${userId}#0001`, displayAvatarURL: () => 'https://cdn.example/avatar.png' },
		member: { id: userId },
		guildId: GUILD,
		guild,
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
		async showModal(modal) { rec.push('modal', modal); },
	};
};

const lastText = (interaction) => interaction.rec.content(interaction.rec.calls.length - 1);

const runCommand = async (client, subcommand, { group = null, strings = {}, integers = {}, booleans = {}, channels = {}, here } = {}) => {
	await redis.del(`ADMIN:${GUILD}:form`, `counter:ADMIN:${GUILD}`);
	const interaction = interactionBase(client);
	Object.assign(interaction, {
		commandName: 'form',
		channel: here,
		isChatInputCommand: () => true,
		options: {
			getSubcommandGroup: () => group,
			getSubcommand: () => subcommand,
			getString: (name) => strings[name] ?? null,
			getInteger: (name) => integers[name] ?? null,
			getBoolean: (name) => booleans[name] ?? null,
			getChannel: (name) => channels[name] ?? null,
		},
	});
	await handler.execute(interaction);
	return interaction;
};

// The answers a member typed, keyed by question label.
const answersFrom = (fields, byLabel) => ({
	getTextInputValue: (customId) => {
		const field = fields.find((f) => `f${f.id}` === customId);
		if (!field) throw new Error(`no input ${customId}`);
		return byLabel[field.label] ?? '';
	},
});

const submit = async (client, formId, fields) => {
	client.cooldown.clear();
	const interaction = interactionBase(client, 'MEMBER');
	Object.assign(interaction, { customId: `form-submit:${formId}`, isModalSubmit: () => true, fields });
	await handler.execute(interaction);
	return interaction;
};

before(async () => {
	await resetDb();
	await Guild.create({ guildID: GUILD, subscription: 'free' });
});
after(closeAll);

describe('forms', () => {
	test('create, add questions, post, fill in, and the answers reach the response channel', async () => {
		const responses = fakeChannel('RESP');
		const lobby = fakeChannel('LOBBY');
		const client = makeWorld([responses, lobby]);

		await runCommand(client, 'create', { strings: { title: 'Staff application' }, channels: { responses } });
		const form = await Form.findOne({ where: { title: 'Staff application' } });
		assert.equal(form.responseChannelID, 'RESP');

		await runCommand(client, 'add', { group: 'field', integers: { form: form.id }, strings: { label: 'Your name' } });
		await runCommand(client, 'add', {
			group: 'field', integers: { form: form.id },
			strings: { label: 'Why you?', style: 'paragraph', placeholder: 'Tell us' }, booleans: { required: false },
		});

		await runCommand(client, 'post', { integers: { form: form.id }, here: lobby });
		const button = lobby.posted[0].payload.components[0].components[0].data;
		assert.equal(button.custom_id, `form-open:${form.id}`);

		const click = interactionBase(client, 'MEMBER');
		Object.assign(click, { customId: button.custom_id, isButton: () => true });
		await handler.execute(click);
		const modal = click.rec.calls[0][1].toJSON();
		assert.equal(modal.custom_id, `form-submit:${form.id}`);
		assert.equal(modal.title, 'Staff application');
		const inputs = modal.components.map((row) => row.components[0]);
		assert.deepEqual(inputs.map((i) => i.label), ['Your name', 'Why you?']);
		assert.deepEqual(inputs.map((i) => i.style), [TextInputStyle.Short, TextInputStyle.Paragraph]);
		assert.deepEqual(inputs.map((i) => i.required), [true, false]);
		assert.equal(inputs[1].placeholder, 'Tell us');

		const fields = await F.formFields(form.id);
		const sent = await submit(client, form.id, answersFrom(fields, { 'Your name': 'Kya', 'Why you?': '' }));
		assert.match(lastText(sent), /Your answers to \*\*Staff application\*\* were sent/);

		const [post] = responses.posted;
		const embed = post.payload.embeds[0].data;
		assert.deepEqual(embed.fields.map((f) => [f.name, f.value]), [['Your name', 'Kya'], ['Why you?', '*No answer*']]);
		assert.match(embed.description, /<@MEMBER>/);
		assert.deepEqual(post.payload.allowedMentions, { parse: [] });
	});

	test('a form holds at most 5 questions, and questions are removed by number', async () => {
		const responses = fakeChannel('RESP2');
		const client = makeWorld([responses]);
		const form = await Form.create({ guildID: GUILD, title: 'Survey', responseChannelID: 'RESP2' });
		for (let i = 1; i <= F.MAX_FIELDS; i++) {
			await runCommand(client, 'add', { group: 'field', integers: { form: form.id }, strings: { label: `Q${i}` } });
		}
		const full = await runCommand(client, 'add', { group: 'field', integers: { form: form.id }, strings: { label: 'Q6' } });
		assert.match(lastText(full), /up to 5 questions/);
		assert.equal(await FormField.count({ where: { formId: form.id } }), 5);

		await runCommand(client, 'remove', { group: 'field', integers: { form: form.id, number: 2 } });
		assert.deepEqual((await F.formFields(form.id)).map((f) => f.label), ['Q1', 'Q3', 'Q4', 'Q5']);
		assert.match(lastText(await runCommand(client, 'remove', { group: 'field', integers: { form: form.id, number: 5 } })), /no question 5/);
	});

	test('refusals: no posting rights, no questions, a missing response channel, a deleted form', async () => {
		const blocked = fakeChannel('BLOCKED', { canPost: false });
		const lobby = fakeChannel('LOBBY2');
		const client = makeWorld([lobby]);

		assert.match(lastText(await runCommand(client, 'create', { strings: { title: 'X' }, channels: { responses: blocked } })), /can't post in/);
		assert.equal(await Form.count({ where: { title: 'X' } }), 0);

		const form = await Form.create({ guildID: GUILD, title: 'Empty', responseChannelID: 'GONE' });
		assert.match(lastText(await runCommand(client, 'post', { integers: { form: form.id }, here: lobby })), /no questions yet/);

		await FormField.create({ formId: form.id, label: 'Q' });
		const fields = await F.formFields(form.id);
		assert.match(lastText(await submit(client, form.id, answersFrom(fields, { Q: 'a' }))), /response channel no longer exists/);

		await runCommand(client, 'post', { integers: { form: form.id }, here: lobby });
		await runCommand(client, 'delete', { integers: { form: form.id } });
		assert.equal(await Form.findByPk(form.id), null);
		assert.equal(await FormField.count({ where: { formId: form.id } }), 0);
		assert.ok(lobby.posted[0].deleted);
		assert.match(lastText(await submit(client, form.id, answersFrom(fields, { Q: 'a' }))), /no longer available/);
	});

	test('a question added after the member opened the form shows as unanswered', async () => {
		const responses = fakeChannel('RESP3');
		const client = makeWorld([responses]);
		const form = await Form.create({ guildID: GUILD, title: 'Changing', responseChannelID: 'RESP3' });
		await FormField.create({ formId: form.id, label: 'Old' });
		const opened = await F.formFields(form.id);
		await FormField.create({ formId: form.id, label: 'New' });

		await submit(client, form.id, answersFrom(opened, { Old: 'yes' }));
		const embed = responses.posted[0].payload.embeds[0].data;
		assert.deepEqual(embed.fields.map((f) => f.value), ['yes', '*No answer*']);
	});

	test('forms from another server are not reachable', async () => {
		const client = makeWorld([]);
		const form = await Form.create({ guildID: 'ELSEWHERE', title: 'Theirs', responseChannelID: 'R' });
		await FormField.create({ formId: form.id, label: 'Q' });

		const click = interactionBase(client, 'MEMBER');
		Object.assign(click, { customId: `form-open:${form.id}`, isButton: () => true });
		await handler.execute(click);
		assert.match(click.rec.content(0), /no longer available/);
		assert.match(lastText(await runCommand(client, 'delete', { integers: { form: form.id } })), /no form/);
	});
});
