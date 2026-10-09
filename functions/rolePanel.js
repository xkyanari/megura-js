const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, roleMention } = require('discord.js');
const { RolePanel, RolePanelRole } = require('../src/db');

/**
 * Button roles: a panel is a message with one button per role. Clicking a
 * button gives the role to the member, or takes it away if they have it.
 *
 * Every click is re-checked against the database and the server's current
 * roles, so a role removed from a panel, or moved above Dahlia, stops working
 * even on panels posted earlier.
 */

// Discord allows 5 rows of 5 buttons per message.
const MAX_ROLES = 25;

const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{17,20}>$/;
const UNICODE_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\u200D|\uFE0F|\u20E3)*$/u;

const isValidEmoji = (emoji) => CUSTOM_EMOJI.test(emoji) || UNICODE_EMOJI.test(emoji);

const REFUSALS = {
	everyone: 'The @everyone role can\'t be given out.',
	managed: 'That role is managed by an integration (a bot or a booster role), so it can\'t be given out.',
	permission: 'I need the **Manage Roles** permission to give out roles.',
	hierarchy: 'That role is above my highest role. Move my role above it in **Server Settings → Roles**.',
};

/**
 * Returns why Dahlia can't give `role` to members, or null if it can.
 * One of the REFUSALS keys.
 */
const assignRefusal = (guild, role) => {
	if (role.id === guild.id) return 'everyone';
	if (role.managed) return 'managed';
	const me = guild.members.me;
	if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return 'permission';
	if (role.position >= me.roles.highest.position) return 'hierarchy';
	return null;
};

// Staff given /roles can only hand out roles below their own, like Discord's own rule.
const outranks = (member, role, guild) =>
	member.id === guild.ownerId || member.roles.highest.position > role.position;

const findPanel = (id, guildID) => RolePanel.findOne({ where: { id, guildID } });

const panelRoles = (panelId) => RolePanelRole.findAll({ where: { panelId }, order: [['id', 'ASC']] });

const panelMessage = (panel, roles) => {
	const lines = roles.map((r) => `${r.emoji ? `${r.emoji} ` : ''}${roleMention(r.roleId)}`);
	const embed = new EmbedBuilder()
		.setTitle(panel.title)
		.setColor(0x5865f2)
		.setDescription([panel.description, lines.join('\n')].filter(Boolean).join('\n\n') || 'No roles yet.')
		.setFooter({ text: 'Click a button to get the role. Click it again to remove it.' });

	const rows = [];
	for (let i = 0; i < roles.length; i += 5) {
		rows.push(new ActionRowBuilder().addComponents(roles.slice(i, i + 5).map((r) => {
			const button = new ButtonBuilder()
				.setCustomId(`role-toggle:${panel.id}:${r.roleId}`)
				.setLabel(r.label)
				.setStyle(ButtonStyle.Secondary);
			if (r.emoji) button.setEmoji(r.emoji);
			return button;
		})));
	}
	return { embeds: [embed], components: rows };
};

const fetchPanelMessage = async (client, panel) => {
	if (!panel.channelID || !panel.messageID) return null;
	const channel = await client.channels.fetch(panel.channelID).catch(() => null);
	return channel ? channel.messages.fetch(panel.messageID).catch(() => null) : null;
};

// Updates the posted panel after its roles change. Returns false if it's no longer there.
const refreshPanel = async (client, panel) => {
	const message = await fetchPanelMessage(client, panel);
	if (!message) return false;
	await message.edit(panelMessage(panel, await panelRoles(panel.id)));
	return true;
};

/**
 * Gives or takes a panel role for the member who clicked.
 * Returns { ok: true, added, roleId } or { ok: false, reason } with reason
 * 'gone' (no longer on the panel) or one of the REFUSALS keys.
 */
const toggleRole = async (interaction, panelId, roleId) => {
	const { guild, member } = interaction;
	const entry = await RolePanelRole.findOne({ where: { panelId, roleId } });
	const panel = entry && await findPanel(panelId, guild.id);
	if (!panel) return { ok: false, reason: 'gone' };

	const role = await guild.roles.fetch(roleId).catch(() => null);
	if (!role) return { ok: false, reason: 'gone' };

	const refusal = assignRefusal(guild, role);
	if (refusal) return { ok: false, reason: refusal };

	const reason = `Button role panel #${panel.id}`;
	if (member.roles.cache.has(roleId)) {
		await member.roles.remove(roleId, reason);
		return { ok: true, added: false, roleId };
	}
	await member.roles.add(roleId, reason);
	return { ok: true, added: true, roleId };
};

module.exports = {
	MAX_ROLES,
	REFUSALS,
	isValidEmoji,
	assignRefusal,
	outranks,
	findPanel,
	panelRoles,
	panelMessage,
	fetchPanelMessage,
	refreshPanel,
	toggleRole,
};
