const { Events } = require('discord.js');
const { Guild } = require('../src/db');

/**
 * This event is fired when the bot joins a server.
 */

module.exports = {
	name: Events.GuildCreate,
	async execute(guild) {
		console.log(`<${Date.now().toString()}> : ${guild.client.user.tag} joined the server <${guild.name}> with guild ID <${guild.id}>.`);
        const guildCheck = await Guild.findOne({ where: {guildID: guild.id }});
        if (!guildCheck) return await Guild.create({ guildID: guild.id });
        if (guildCheck) return;
	},
};