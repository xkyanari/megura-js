const { Events } = require('discord.js');

module.exports = {
	name: Events.GuildMemberAdd,
	async execute(member) {
		console.log(`${member.user.tag} joined the server.`);
	},
};