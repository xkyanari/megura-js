const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Collection, PermissionFlagsBits } = require('discord.js');
const redis = require('../redis');
const { Guild, RolePanel, RolePanelRole } = require('../src/db');
const handler = require('../events/InteractionCreate');
const rolesCommand = require('../commands/slash-commands/roles');
const toggleButton = require('../components/buttons/role-toggle');
const R = require('../functions/rolePanel');
const { resetDb, closeAll, recorder } = require('./helpers');

const GUILD = 'GR';

// Server roles by position: Dahlia's own role sits at 10.
const serverRoles = [
	{ id: GUILD, name: '@everyone', position: 0, managed: false },
	{ id: 'GAMER', name: 'Gamer', position: 2, managed: false },
	{ id: 'ART', name: 'Artist', position: 3, managed: false },
	{ id: 'BOOST', name: 'Booster', position: 4, managed: true },
	{ id: 'MOD', name: 'Moderator', position: 8, managed: false },
	{ id: 'ADMIN', name: 'Admin', position: 20, managed: false },
];
const role = (id) => serverRoles.find((r) => r.id === id);

const fakeGuild = ({ manageRoles = true } = {}) => ({
	id: GUILD,
	ownerId: 'OWNER',
	members: {
		me: {
			permissions: { has: (flag) => manageRoles && flag === PermissionFlagsBits.ManageRoles },
			roles: { highest: { position: 10 } },
		},
	},
	roles: { fetch: async (id) => role(id) ?? null },
});

const fakeMember = (id, highest = 5, held = []) => {
	const cache = new Set(held);
	return {
		id,
		roles: {
			highest: { position: highest },
			cache,
			add: async (roleId) => { cache.add(roleId); },
			remove: async (roleId) => { cache.delete(roleId); },
		},
	};
};

const fakeChannel = (id) => {
	const posted = [];
	return {
		id,
		posted,
		send: async (payload) => {
			const message = {
				id: `M${posted.length + 1}`,
				payload,
				edits: [],
				deleted: false,
				async edit(p) { this.edits.push(p); },
				async delete() { this.deleted = true; },
			};
			posted.push(message);
			return message;
		},
		messages: { fetch: async (messageId) => posted.find((m) => m.id === messageId && !m.deleted) ?? null },
	};
};

const makeClient = (channels) => ({
	commands: new Collection([['roles', rolesCommand]]),
	buttons: new Collection([['role-toggle', toggleButton]]),
	cooldown: new Collection(),
	channels: { fetch: async (id) => channels.find((c) => c.id === id) ?? null },
});

const interactionBase = (client, { guild = fakeGuild(), member = fakeMember('HOST', 15) } = {}) => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		client,
		user: { id: member.id, tag: `${member.id}#0001` },
		member,
		guildId: guild.id,
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
	};
};

const runCommand = async (client, subcommand, { strings = {}, integers = {}, roleId, channel, here, guild, member } = {}) => {
	const userId = member?.id ?? 'HOST';
	await redis.del(`${userId}:${GUILD}:roles`, `counter:${userId}:${GUILD}`);
	const interaction = interactionBase(client, { guild, member });
	Object.assign(interaction, {
		commandName: 'roles',
		channel: here,
		isChatInputCommand: () => true,
		options: {
			getSubcommand: () => subcommand,
			getString: (name) => strings[name] ?? null,
			getInteger: (name) => integers[name] ?? null,
			getRole: () => (roleId ? role(roleId) : null),
			getChannel: () => channel ?? null,
		},
	});
	await handler.execute(interaction);
	return interaction;
};

const click = async (client, customId, member, guild) => {
	const interaction = interactionBase(client, { guild, member });
	Object.assign(interaction, { customId, isButton: () => true });
	await handler.execute(interaction);
	return interaction.rec.content(0);
};

const lastText = (interaction) => interaction.rec.content(interaction.rec.calls.length - 1);

before(async () => {
	await resetDb();
	await Guild.create({ guildID: GUILD, subscription: 'free' });
	await Guild.create({ guildID: 'OTHER', subscription: 'free' });
});
after(closeAll);

describe('engine', () => {
	test('assignRefusal rejects @everyone, managed, roles above Dahlia, and missing Manage Roles', () => {
		const guild = fakeGuild();
		assert.equal(R.assignRefusal(guild, role(GUILD)), 'everyone');
		assert.equal(R.assignRefusal(guild, role('BOOST')), 'managed');
		assert.equal(R.assignRefusal(guild, role('ADMIN')), 'hierarchy');
		assert.equal(R.assignRefusal(guild, { id: 'SAME', position: 10, managed: false }), 'hierarchy');
		assert.equal(R.assignRefusal(fakeGuild({ manageRoles: false }), role('GAMER')), 'permission');
		assert.equal(R.assignRefusal(guild, role('GAMER')), null);
	});

	test('panelMessage lays out up to 5 buttons per row', () => {
		const roles = Array.from({ length: 12 }, (_, i) => ({ roleId: `R${i}`, label: `Role ${i}`, emoji: i ? null : '🎮' }));
		const { components } = R.panelMessage({ id: 7, title: 'Pick' }, roles);
		assert.deepEqual(components.map((row) => row.components.length), [5, 5, 2]);
		assert.equal(components[0].components[0].data.custom_id, 'role-toggle:7:R0');
		assert.equal(components[0].components[0].data.emoji.name, '🎮');
	});
});

describe('/roles and the role buttons', () => {
	test('create, add, post, then members toggle the role', async () => {
		const here = fakeChannel('HERE');
		const client = makeClient([here]);

		await runCommand(client, 'create', { strings: { title: 'Pick your roles' } });
		const panel = await RolePanel.findOne({ where: { title: 'Pick your roles' } });
		assert.equal(panel.guildID, GUILD);

		const added = await runCommand(client, 'add', { integers: { panel: panel.id }, roleId: 'GAMER', strings: { emoji: '🎮' } });
		assert.match(lastText(added), /Added <@&GAMER>/);
		const entry = await RolePanelRole.findOne({ where: { panelId: panel.id } });
		assert.equal(entry.label, 'Gamer', 'label defaults to the role name');

		await runCommand(client, 'post', { integers: { panel: panel.id }, here });
		const button = here.posted[0].payload.components[0].components[0].data;
		assert.equal(button.custom_id, `role-toggle:${panel.id}:GAMER`);
		assert.equal((await panel.reload()).messageID, here.posted[0].id);

		const member = fakeMember('U1');
		assert.match(await click(client, button.custom_id, member), /You now have the <@&GAMER> role/);
		assert.ok(member.roles.cache.has('GAMER'));
		client.cooldown.clear();
		assert.match(await click(client, button.custom_id, member), /Removed the <@&GAMER> role/);
		assert.ok(!member.roles.cache.has('GAMER'));
	});

	test('adding a role updates the posted panel; reposting takes the old post down', async () => {
		const here = fakeChannel('HERE2');
		const elsewhere = fakeChannel('ELSE');
		const client = makeClient([here, elsewhere]);
		const panel = await RolePanel.create({ guildID: GUILD, title: 'Live' });
		await RolePanelRole.create({ panelId: panel.id, roleId: 'GAMER', label: 'Gamer' });

		await runCommand(client, 'post', { integers: { panel: panel.id }, here });
		await runCommand(client, 'add', { integers: { panel: panel.id }, roleId: 'ART', strings: { label: 'Art' } });
		const [edit] = here.posted[0].edits;
		assert.deepEqual(edit.components[0].components.map((b) => b.data.label), ['Gamer', 'Art']);

		await runCommand(client, 'add', { integers: { panel: panel.id }, roleId: 'ART', strings: { label: 'Artists' } });
		assert.equal(await RolePanelRole.count({ where: { panelId: panel.id } }), 2, 'adding again updates, not duplicates');
		assert.equal(here.posted[0].edits[1].components[0].components[1].data.label, 'Artists');

		await runCommand(client, 'post', { integers: { panel: panel.id }, channel: elsewhere, here });
		assert.ok(here.posted[0].deleted);
		assert.equal((await panel.reload()).channelID, 'ELSE');
	});

	test('add refuses managed roles, roles above Dahlia or the caller, bad emoji, and a full panel', async () => {
		const client = makeClient([]);
		const panel = await RolePanel.create({ guildID: GUILD, title: 'Refusals' });
		const add = (roleId, extra = {}) => runCommand(client, 'add', { integers: { panel: panel.id }, roleId, ...extra });

		assert.match(lastText(await add('BOOST')), /managed by an integration/);
		assert.match(lastText(await add('ADMIN')), /above my highest role/);
		assert.match(lastText(await add(GUILD)), /@everyone/);
		assert.match(lastText(await add('MOD', { member: fakeMember('STAFF', 6) })), /below your own highest role/);
		assert.match(lastText(await add('GAMER', { strings: { emoji: 'gamer' } })), /doesn't look like an emoji/);
		assert.equal(await RolePanelRole.count({ where: { panelId: panel.id } }), 0);

		// the owner may add any role Dahlia can give, whatever their own roles
		assert.match(lastText(await add('MOD', { member: fakeMember('OWNER', 0) })), /Added/);

		await RolePanelRole.bulkCreate(Array.from({ length: R.MAX_ROLES - 1 }, (_, i) => ({ panelId: panel.id, roleId: `X${i}`, label: 'x' })));
		assert.match(lastText(await add('GAMER')), /up to 25 roles/);
	});

	test('buttons stop working once the role leaves the panel or moves above Dahlia', async () => {
		const client = makeClient([]);
		const panel = await RolePanel.create({ guildID: GUILD, title: 'Checks' });
		await RolePanelRole.create({ panelId: panel.id, roleId: 'ART', label: 'Art' });
		const member = fakeMember('U2');

		// a forged custom ID for a role that was never on the panel
		assert.match(await click(client, `role-toggle:${panel.id}:ADMIN`, member), /no longer on this panel/);
		// the panel belongs to another server
		const other = { ...fakeGuild(), id: 'OTHER' };
		assert.match(await click(client, `role-toggle:${panel.id}:ART`, member, other), /no longer on this panel/);

		role('ART').position = 12;
		try {
			assert.match(await click(client, `role-toggle:${panel.id}:ART`, member), /above my highest role/);
		}
		finally {
			role('ART').position = 3;
		}
		assert.equal(member.roles.cache.size, 0);

		await runCommand(client, 'remove', { integers: { panel: panel.id }, roleId: 'ART' });
		client.cooldown.clear();
		assert.match(await click(client, `role-toggle:${panel.id}:ART`, member), /no longer on this panel/);
	});

	test('delete removes the panel, its roles and its post; other servers can\'t touch it', async () => {
		const here = fakeChannel('HERE3');
		const client = makeClient([here]);
		const panel = await RolePanel.create({ guildID: GUILD, title: 'Doomed' });
		await RolePanelRole.create({ panelId: panel.id, roleId: 'GAMER', label: 'Gamer' });
		await runCommand(client, 'post', { integers: { panel: panel.id }, here });

		const foreign = await runCommand(client, 'delete', { integers: { panel: panel.id }, guild: { ...fakeGuild(), id: 'OTHER' } });
		assert.match(lastText(foreign), /no role panel/i);

		await runCommand(client, 'delete', { integers: { panel: panel.id } });
		assert.equal(await RolePanel.findByPk(panel.id), null);
		assert.equal(await RolePanelRole.count({ where: { panelId: panel.id } }), 0);
		assert.ok(here.posted[0].deleted);
	});
});
