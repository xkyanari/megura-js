const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const Queue = require('bull');
const { Collection, PermissionFlagsBits } = require('discord.js');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Guild, Ticket, TicketConfig } = require('../src/db');
const handler = require('../events/InteractionCreate');
const ticketCommand = require('../commands/slash-commands/ticket');
const openButton = require('../components/buttons/ticket-open');
const closeButton = require('../components/buttons/ticket-close');
const T = require('../functions/ticket');
const { resetDb, closeAll, recorder } = require('./helpers');

const GUILD = 'GT';
const queue = new Queue(`ticketTest${Date.now()}`, redisURL);

// A server whose channels can be created, fetched and deleted. Channel IDs
// are unique across worlds, like Discord's.
let worlds = 0;
const makeWorld = ({ failCreate = false } = {}) => {
	const prefix = `W${++worlds}CH`;
	const channels = new Map();
	const created = [];
	const makeChannel = (id, extra = {}) => {
		const posted = [];
		const channel = {
			id,
			posted,
			deleted: false,
			send: async (payload) => { posted.push(payload); return { id: `M${posted.length}` }; },
			async delete() { this.deleted = true; channels.delete(id); },
			...extra,
		};
		channels.set(id, channel);
		return channel;
	};
	const guild = {
		id: GUILD,
		members: { me: { permissions: { has: () => true } } },
		roles: { fetch: async (id) => (['STAFF', GUILD].includes(id) ? { id } : null) },
		channels: {
			create: async (options) => {
				if (failCreate) throw new Error('Missing Permissions');
				created.push(options);
				return makeChannel(`${prefix}${created.length}`, { options });
			},
		},
	};
	const client = {
		user: { id: 'BOT' },
		commands: new Collection([['ticket', ticketCommand]]),
		buttons: new Collection([['ticket-open', openButton], ['ticket-close', closeButton]]),
		cooldown: new Collection(),
		ticketQueue: queue,
		channels: { fetch: async (id) => channels.get(id) ?? null },
	};
	return { guild, client, channels, created, makeChannel };
};

const fakeMember = (id, { roles = [], manageChannels = false } = {}) => ({
	id,
	roles: { cache: new Set(roles) },
	permissions: { has: (flag) => manageChannels && flag === PermissionFlagsBits.ManageChannels },
});

const interactionBase = (world, member, channelId = 'LOBBY') => {
	const rec = recorder();
	return {
		rec,
		deferred: false,
		replied: false,
		client: world.client,
		user: { id: member.id, tag: `${member.id}#0001` },
		member,
		guildId: GUILD,
		guild: world.guild,
		channelId,
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

const lastText = (interaction) => interaction.rec.content(interaction.rec.calls.length - 1);

const click = async (world, customId, member, channelId) => {
	world.client.cooldown.clear();
	const interaction = interactionBase(world, member, channelId);
	Object.assign(interaction, { customId, isButton: () => true });
	await handler.execute(interaction);
	return interaction;
};

const runCommand = async (world, subcommand, member, { role, channel, channelId, strings = {} } = {}) => {
	await redis.del(`${member.id}:${GUILD}:ticket`, `counter:${member.id}:${GUILD}`);
	const interaction = interactionBase(world, member, channelId);
	Object.assign(interaction, {
		commandName: 'ticket',
		channel: world.channels.get(channelId),
		isChatInputCommand: () => true,
		options: {
			getSubcommand: () => subcommand,
			getRole: () => role ?? null,
			getChannel: (name) => (name === 'channel' ? channel ?? null : null),
			getString: (name) => strings[name] ?? null,
		},
	});
	await handler.execute(interaction);
	return interaction;
};

const admin = fakeMember('ADMIN', { manageChannels: true });

before(async () => {
	await resetDb();
	await Guild.create({ guildID: GUILD, subscription: 'free' });
});
after(async () => {
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('tickets', () => {
	test('setup and panel: refuses a panel before setup, then posts the Open button', async () => {
		const world = makeWorld();
		const lobby = world.makeChannel('LOBBY');

		assert.match(lastText(await runCommand(world, 'panel', admin, { channelId: 'LOBBY' })), /\/ticket setup/);
		assert.match(lastText(await runCommand(world, 'setup', admin, { role: { id: GUILD, name: '@everyone' } })), /other than @everyone/);

		await runCommand(world, 'setup', admin, { role: { id: 'STAFF', name: 'Staff' } });
		assert.equal((await TicketConfig.findByPk(GUILD)).staffRoleID, 'STAFF');

		await runCommand(world, 'panel', admin, { channelId: 'LOBBY' });
		assert.equal(lobby.posted[0].components[0].components[0].data.custom_id, 'ticket-open');
	});

	test('opening creates a private channel; a second click points to it', async () => {
		const world = makeWorld();
		const member = fakeMember('U1');

		const first = await click(world, 'ticket-open', member);
		assert.match(lastText(first), /Your ticket is open: <#W\d+CH1>/);

		const ticket = await Ticket.findOne({ where: { openerID: 'U1', status: 'open' } });
		assert.equal(ticket.channelID, `W${worlds}CH1`);
		const [options] = world.created;
		assert.equal(options.name, `ticket-${ticket.id}`);
		const byId = Object.fromEntries(options.permissionOverwrites.map((o) => [o.id, o]));
		assert.deepEqual(byId[GUILD].deny, [PermissionFlagsBits.ViewChannel], '@everyone can\'t see it');
		assert.ok(byId.U1.allow.includes(PermissionFlagsBits.ViewChannel));
		assert.ok(byId.STAFF.allow.includes(PermissionFlagsBits.ManageMessages));
		assert.ok(byId.BOT.allow.includes(PermissionFlagsBits.ManageChannels));

		const welcome = world.channels.get(ticket.channelID).posted[0];
		assert.equal(welcome.components[0].components[0].data.custom_id, `ticket-close:${ticket.id}`);

		const second = await click(world, 'ticket-open', member);
		assert.match(lastText(second), new RegExp(`already have an open ticket: <#${ticket.channelID}>`));
		assert.equal(world.created.length, 1);
	});

	test('simultaneous clicks still open one ticket', async () => {
		const world = makeWorld();
		const member = fakeMember('U2');
		const results = await Promise.all(Array.from({ length: 5 }, () => T.openTicket({
			guild: world.guild, client: world.client, user: { id: 'U2', tag: 'U2#0001' }, member,
		})));
		assert.equal(results.filter((r) => r.ok).length, 1);
		assert.equal(await Ticket.count({ where: { openerID: 'U2', status: 'open' } }), 1);
		assert.equal(world.created.length, 1);
	});

	test('a ticket whose channel was deleted by hand no longer blocks a new one', async () => {
		const world = makeWorld();
		const member = fakeMember('U3');
		await click(world, 'ticket-open', member);
		world.channels.clear();

		assert.match(lastText(await click(world, 'ticket-open', member)), /Your ticket is open/);
		assert.equal(await Ticket.count({ where: { openerID: 'U3' } }), 2);
		assert.equal(await Ticket.count({ where: { openerID: 'U3', status: 'open' } }), 1);
	});

	test('if the channel can\'t be created, no ticket is left behind', async () => {
		const world = makeWorld({ failCreate: true });
		await click(world, 'ticket-open', fakeMember('U4'));
		assert.equal(await Ticket.count({ where: { openerID: 'U4' } }), 0);
	});

	test('closing: only the opener or staff, only once, and the channel is deleted later', async () => {
		const world = makeWorld();
		await click(world, 'ticket-open', fakeMember('U5'));
		const ticket = await Ticket.findOne({ where: { openerID: 'U5', status: 'open' } });
		const id = `ticket-close:${ticket.id}`;

		assert.match(lastText(await click(world, id, fakeMember('STRANGER'))), /Only the member who opened/);

		const results = await Promise.all([fakeMember('U5'), fakeMember('S1', { roles: ['STAFF'] })]
			.map((m) => T.closeTicketFor(interactionBase(world, m), ticket.id)));
		assert.equal(results.filter((r) => r.ok).length, 1, 'closed exactly once');
		assert.match(lastText(await click(world, id, fakeMember('U5'))), /already closed/);

		await ticket.reload();
		assert.equal(ticket.status, 'closed');
		assert.equal(ticket.openSlot, null);

		const job = await queue.getJob(`ticket-delete-${ticket.id}`);
		assert.ok(job, 'deletion is scheduled');
		assert.equal(job.opts.delay, T.DELETE_DELAY);
		assert.equal(await T.processTicketJob(world.client, job.data), true);
		assert.equal(world.channels.has(ticket.channelID), false);
		assert.equal(await T.processTicketJob(world.client, job.data), false, 'already gone is fine');

		// closed tickets don't count towards the one-open-ticket limit
		assert.match(lastText(await click(world, 'ticket-open', fakeMember('U5'))), /Your ticket is open/);
	});

	test('/ticket close works inside a ticket channel only', async () => {
		const world = makeWorld();
		await click(world, 'ticket-open', fakeMember('U6'));
		const ticket = await Ticket.findOne({ where: { openerID: 'U6', status: 'open' } });

		assert.match(lastText(await runCommand(world, 'close', admin, { channelId: 'LOBBY' })), /isn't a ticket/);
		assert.match(lastText(await runCommand(world, 'close', admin, { channelId: ticket.channelID })), /Ticket closed by <@ADMIN>/);
		assert.equal((await ticket.reload()).status, 'closed');
	});
});
