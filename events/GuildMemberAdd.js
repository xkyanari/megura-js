const { Events } = require('discord.js');

/**
 * This event is fired when a user joins the server.
 */

module.exports = {
	name: Events.GuildMemberAdd,
	async execute(member) {
		if (member.client.user.bot) return;
		console.log(`<${Date.now().toString()}> : ${member.user.tag} joined the server.`);
	},
};