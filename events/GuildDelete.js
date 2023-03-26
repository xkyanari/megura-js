const { Events } = require('discord.js');
const { Guild } = require('../src/db');

/**
 * This event is fired when the bot leaves a server.
 */

module.exports = {
	name: Events.GuildDelete,
	async execute(guild) {
		console.log(`<${Date.now().toString()}> : ${guild.client.user.tag} left the server <${guild.name}> with guild ID <${guild.id}>.`);
        const guildCheck = await Guild.findOne({ where: {guildID: guild.id }});
        if (guildCheck) return Guild.destroy({ where: {guildID: guild.id}});
        if (!guildCheck) return;
	},
};