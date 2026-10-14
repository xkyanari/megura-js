const { Events, EmbedBuilder } = require('discord.js');
const sendLogs = require('../functions/logs');

/**
 * This event is fired when a role was created in the guild.
 */

module.exports = {
	name: Events.GuildRoleCreate,
	async execute(role) {
		const embed = new EmbedBuilder()
			.setTitle('Role Created.')
			.setColor('Green')
			.addFields(
				{ name: 'Role Name', value: role.name, inline: false },
				{ name: 'Role ID', value: role.id, inline: false },
			);

		const logEntry = `Role created: ${role.name} (${role.id}).`;

		return sendLogs(role.client, role.guild.id, embed, logEntry);
	},
};
