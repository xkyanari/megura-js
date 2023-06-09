const { Events, EmbedBuilder } = require('discord.js');
const sendLogs = require('../functions/logs');

/**
 * This event is fired when a role is updated in the guild.
 */

module.exports = {
	name: Events.GuildRoleUpdate,
	async execute(oldRole, newRole) {
		const guild = newRole.guild;
		const client = guild.client;

		try {
			const embed = new EmbedBuilder()
				.setTitle('Role Updated.')
				.setColor('Yellow')
				.addFields(
					{ name: 'Role Name', value: newRole.name, inline: false },
					{ name: 'Role ID', value: newRole.id, inline: false },
				);

			const oldPermissions = oldRole.permissions.toArray().join(', ');
			const newPermissions = newRole.permissions.toArray().join(', ');

			if (oldPermissions !== newPermissions) {
				if (oldPermissions) {
					embed.addFields({
						name: 'Old Permissions',
						value: oldPermissions,
						inline: false,
					});
				}

				if (newPermissions) {
					embed.addFields({
						name: 'New Permissions',
						value: newPermissions,
						inline: false,
					});
				}
			}

			const logEntry = `Role updated: Old - <${oldRole.name} (${oldRole.id})>, New - <${newRole.name} (${newRole.id})>.`;

			return sendLogs(client, guild.id, embed, logEntry);
		}
		catch (error) {
			console.error(error);
		}
	},
};
