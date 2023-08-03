const { Events, EmbedBuilder } = require('discord.js');
const sendLogs = require('../functions/logs');

/**
 * This event is fired when a user deletes a message.
 */

module.exports = {
	name: Events.MessageDelete,
	async execute(message) {
		if (message.author.bot) return;

		try {
			const embed = new EmbedBuilder()
				.setTitle('Message Deleted.')
				.setColor('Red').setDescription(`
                    > **Author** : <@${message.author.id}>
                    > **Date** : ${message.createdAt}
                    > **Channel** : <#${message.channel.id}>
                    > **Deleted Message** : \`${message.content.replace(
		/`/g,
		'\'',
	)}\`
                `);

			const logEntry = `Message Deleted: ${message.author.tag} - ${message.author.id
			} deleted "${message.content.replace(/`/g, '\'')}"`;
			return sendLogs(message.client, message.guild.id, embed, logEntry);
		}
		catch (error) {
			console.error(error);
		}
	},
};
