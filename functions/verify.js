const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Guild } = require('../src/db');

module.exports = async (interaction, channelID) => {
	const message = interaction.client.channels.cache.get(channelID);
	const guild = await Guild.findOne({ where: {guildID: interaction.guild.id} });

	try {
		const embed = new EmbedBuilder()
            .setTitle(`👋 Welcome to __${interaction.guild.name}__!`)
            .setColor('Aqua')
            .setDescription(`
				${guild.intro}

				${guild.rules}

				${guild.closing}
			`);
		
		const button = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('captcha')
					.setEmoji('✅')
					.setLabel('Verify')
					.setStyle(ButtonStyle.Success)
			);
		
		await message.send({ embeds: [embed], components: [button] });
	} catch (error) {
		// await interaction.editReply({ content: `I don't seem have permissions to send a message on that channel.`, ephemeral: true });
		console.log(error);
	}
};