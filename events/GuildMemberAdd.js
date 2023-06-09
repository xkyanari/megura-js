const { Events, EmbedBuilder } = require('discord.js');
const sendLogs = require('../functions/logs');

/**
 * This event is fired when a user joins the server.
 */

module.exports = {
	name: Events.GuildMemberAdd,
	async execute(member) {
		if (member.user.bot) return;

		const embed = new EmbedBuilder()
			.setTitle('User Joined.')
			.setColor('Green')
			.setDescription(
				`
				> **Member** : <@${member.user.id}>
			`,
			)
			.setThumbnail(
				`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
			);

		const logEntry = `"${member.user.tag}" - ${member.user.id} has joined the server.`;
		return sendLogs(member.client, member.guild.id, embed, logEntry);
	},
};
