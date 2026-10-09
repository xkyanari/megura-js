const { Events, EmbedBuilder } = require('discord.js');
const sendLogs = require('../functions/logs');
const { serverID } = require('../src/vars');

/**
 * This event is fired when the bot leaves (or is removed from) a server.
 */

module.exports = {
	name: Events.GuildDelete,
	async execute(guild) {
		try {
			// Keep the server's settings (plan, wallet, channels): if the bot is
			// invited back, everything is as it was.
			const embed = new EmbedBuilder().setTitle('Guild Left.').setColor('Red')
				.setDescription(`
					> **Guild Name** : ${guild.name}
					> **Guild ID** : ${guild.id}
				`);

			const logEntry = `${guild.client.user.tag} left <${guild.name}> - <${guild.id}>.`;
			return sendLogs(guild.client, serverID, embed, logEntry);
		}
		catch (error) {
			console.error(error);
		}
	},
};
