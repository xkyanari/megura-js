const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	PermissionFlagsBits,
	channelMention,
	roleMention,
	userMention,
} = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { sequelize, Ticket, TicketConfig } = require('../src/db');
const sendLogs = require('./logs');

/**
 * Support tickets: a member clicks "Open ticket" and gets a private channel
 * that only they, the staff role and server admins can see. Either side
 * closes it with the Close button; the channel is deleted shortly after.
 *
 * One open ticket per member, enforced by a unique index (see models/ticket.js).
 * Closing locks the row, so it happens once however many people click Close.
 */

// How long a closed ticket's channel stays before it is deleted.
const DELETE_DELAY = 10 * 1000;

const MEMBER_PERMISSIONS = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.ReadMessageHistory,
	PermissionFlagsBits.AttachFiles,
	PermissionFlagsBits.EmbedLinks,
];

const openButton = () => new ActionRowBuilder().addComponents(
	new ButtonBuilder()
		.setCustomId('ticket-open')
		.setEmoji('🎫')
		.setLabel('Open ticket')
		.setStyle(ButtonStyle.Primary),
);

const closeButton = (ticket) => new ActionRowBuilder().addComponents(
	new ButtonBuilder()
		.setCustomId(`ticket-close:${ticket.id}`)
		.setEmoji('🔒')
		.setLabel('Close')
		.setStyle(ButtonStyle.Danger),
);

const panelEmbed = (description) => new EmbedBuilder()
	.setTitle('Need help?')
	.setColor(0xcd7f32)
	.setDescription(description || 'Click **Open ticket** to talk to the staff in a private channel.');

const overwrites = (guild, config, openerId, botId) => [
	{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
	{ id: openerId, allow: MEMBER_PERMISSIONS },
	{ id: config.staffRoleID, allow: [...MEMBER_PERMISSIONS, PermissionFlagsBits.ManageMessages] },
	{ id: botId, allow: [...MEMBER_PERMISSIONS, PermissionFlagsBits.ManageChannels] },
];

const channelExists = async (client, channelId) =>
	Boolean(channelId && await client.channels.fetch(channelId).catch(() => null));

const findOpenTicket = (guildID, openerID) => Ticket.findOne({ where: { guildID, openerID, status: 'open' } });

// Closes a ticket. Returns the ticket, or null if it was already closed.
const closeTicket = (id, closedBy) => sequelize.transaction(async (transaction) => {
	const ticket = await Ticket.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
	if (!ticket || ticket.status !== 'open') return null;
	await ticket.update({ status: 'closed', openSlot: null, closedBy, closedAt: new Date() }, { transaction });
	return ticket;
});

const logTicket = (client, guildId, title, text, entry) => sendLogs(
	client,
	guildId,
	new EmbedBuilder().setTitle(title).setColor('Blue').setDescription(text),
	entry,
);

/**
 * Opens a ticket for the member who clicked. Returns { ok: true, ticket, channel }
 * or { ok: false, reason, channelId? } with reason 'not set up', 'staff role missing'
 * or 'already open' (with the existing ticket's channel).
 */
const openTicket = async (interaction) => {
	const { guild, client, user } = interaction;
	const config = await TicketConfig.findByPk(guild.id);
	if (!config) return { ok: false, reason: 'not set up' };
	if (!await guild.roles.fetch(config.staffRoleID).catch(() => null)) {
		return { ok: false, reason: 'staff role missing' };
	}

	const existing = await findOpenTicket(guild.id, user.id);
	if (existing) {
		if (await channelExists(client, existing.channelID)) {
			return { ok: false, reason: 'already open', channelId: existing.channelID };
		}
		// someone deleted the channel by hand: free the member up
		await closeTicket(existing.id, null);
	}

	let ticket;
	try {
		ticket = await Ticket.create({ guildID: guild.id, openerID: user.id });
	}
	catch (error) {
		if (!(error instanceof UniqueConstraintError)) throw error;
		const other = await findOpenTicket(guild.id, user.id);
		return { ok: false, reason: 'already open', channelId: other?.channelID };
	}

	let channel;
	try {
		channel = await guild.channels.create({
			name: `ticket-${ticket.id}`,
			type: ChannelType.GuildText,
			parent: config.categoryID ?? undefined,
			topic: `Ticket #${ticket.id} opened by ${user.tag ?? user.username}`,
			permissionOverwrites: overwrites(guild, config, user.id, client.user.id),
		});
	}
	catch (error) {
		// no channel, no ticket: let them try again once the problem is fixed
		await ticket.destroy();
		throw error;
	}
	await ticket.update({ channelID: channel.id });

	await channel.send({
		content: `${userMention(user.id)} ${roleMention(config.staffRoleID)}`,
		embeds: [new EmbedBuilder()
			.setTitle(`Ticket #${ticket.id}`)
			.setColor(0xcd7f32)
			.setDescription('Tell us what you need and a staff member will be with you soon.\nClick **Close** when you\'re done.')],
		components: [closeButton(ticket)],
		allowedMentions: { users: [user.id], roles: [config.staffRoleID] },
	});
	await logTicket(
		client, guild.id, 'Ticket opened',
		`${userMention(user.id)} opened ticket #${ticket.id}: ${channelMention(channel.id)}`,
		`${user.tag ?? user.username} (${user.id}) opened ticket #${ticket.id}`,
	);

	return { ok: true, ticket, channel };
};

// The opener, the staff role, and anyone who can manage channels may close a ticket.
const canClose = (member, ticket, config) => member.id === ticket.openerID
	|| (config && member.roles.cache.has(config.staffRoleID))
	|| member.permissions.has(PermissionFlagsBits.ManageChannels);

const scheduleDelete = async (client, ticket) => {
	try {
		await client.ticketQueue.add(
			{ ticketId: ticket.id, channelId: ticket.channelID },
			{ jobId: `ticket-delete-${ticket.id}`, delay: DELETE_DELAY, attempts: 3, removeOnComplete: true },
		);
	}
	catch (error) {
		console.error(`Could not schedule deleting ticket ${ticket.id}:`, error);
	}
};

// Runs a job queued on client.ticketQueue (see events/ClientReady.js).
const processTicketJob = async (client, { channelId }) => {
	const channel = await client.channels.fetch(channelId).catch(() => null);
	if (!channel) return false;
	await channel.delete('Ticket closed');
	return true;
};

/**
 * Closes the ticket `id` for the member in `interaction`. Returns
 * { ok: true, ticket } or { ok: false, reason } with reason 'not found',
 * 'not allowed' or 'already closed'.
 */
const closeTicketFor = async (interaction, id) => {
	const { guild, member, user, client } = interaction;
	const ticket = await Ticket.findOne({ where: { id, guildID: guild.id } });
	if (!ticket) return { ok: false, reason: 'not found' };

	const config = await TicketConfig.findByPk(guild.id);
	if (!canClose(member, ticket, config)) return { ok: false, reason: 'not allowed' };

	const closed = await closeTicket(ticket.id, user.id);
	if (!closed) return { ok: false, reason: 'already closed' };

	await scheduleDelete(client, closed);
	await logTicket(
		client, guild.id, 'Ticket closed',
		`${userMention(user.id)} closed ticket #${closed.id}, opened by ${userMention(closed.openerID)}.`,
		`${user.tag ?? user.username} (${user.id}) closed ticket #${closed.id}`,
	);
	return { ok: true, ticket: closed };
};

module.exports = {
	DELETE_DELAY,
	openButton,
	closeButton,
	panelEmbed,
	openTicket,
	closeTicket,
	closeTicketFor,
	canClose,
	processTicketJob,
};
