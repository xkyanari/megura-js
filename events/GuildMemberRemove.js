const { Events, EmbedBuilder } = require('discord.js');
const { Player, Iura, Item } = require('../src/db');
const sendLogs = require('../functions/logs');

/**
 * This event is fired when a user leaves the server.
 */

module.exports = {
	name: Events.GuildMemberRemove,
	async execute(member) {
		if (member.user.bot) return;
		console.log(`<${Date.now().toString()}> : ${member.user.tag} left the server.`);

		try {
			const player = await Player.findOne({ where: { discordID: member.user.id, guildID: member.guild.id }, include: 'iura' });

			if (player) {
				await Item.destroy({ where: { accountID: player.iura.accountID }});
				await Iura.destroy({ where: { accountID: player.iura.accountID }});
				await Player.destroy({ where: { discordID: member.user.id, guildID: member.guild.id }});
				console.log(`<${Date.now().toString()}> : Player profile for ${member.user.tag} has been removed.`);
			} else {
				console.log(`<${Date.now().toString()}> : No player profile under ${member.user.tag} was removed.`);
			}

			const embed = new EmbedBuilder()
				.setTitle('User Left.')
				.setColor('Red')
				.setDescription(`
					> **Member** : <@${member.user.id}>
				`)
				.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`);
			
			const logEntry = `"${member.user.tag}" - ${member.user.id} has left the server.`;
			return sendLogs(member.client, member.guild.id, embed, logEntry);
		} catch (e) {
			console.log(e);
		}
	},
};