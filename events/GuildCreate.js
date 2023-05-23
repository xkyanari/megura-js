const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { Guild } = require('../src/db');
const sendLogs = require('../functions/logs');
const { serverID } = require('../src/vars');

/**
 * This event is fired when the bot joins a server.
 */

module.exports = {
	name: Events.GuildCreate,
	async execute(guild) {
		try {
			const guildCheck = await Guild.findOne({ where: {guildID: guild.id }});
			if (!guildCheck) {
				await Guild.create({ guildID: guild.id });
			}
	
			const embed = new EmbedBuilder()
				.setTitle('Guild Joined.')
				.setColor('Green')
				.setDescription(`
					> **Guild Name** : ${guild.name}
					> **Guild ID** : ${guild.id}
				`);
			
			const logEntry = `${guild.client.user.tag} joined <${guild.name}> - <${guild.id}>.`;
			return sendLogs(guild.client, serverID, embed, logEntry);
		} catch (error) {
			console.error(error);
		}
	},
};
