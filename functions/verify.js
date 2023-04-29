const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { Guild } = require('../src/db');

module.exports = async (interaction, channelID) => {
	const message = interaction.client.channels.cache.get(channelID);
	const guild = await Guild.findOne({ where: {guildID: interaction.guild.id} });

	if (!message.permissionsFor(interaction.client.user).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) return await interaction.reply({
		content: `I don't seem have permissions to send messages on that channel.`,
		ephemeral: true
	});

	if (!guild.intro || !guild.rules || !guild.closing) return interaction.reply({
		content: `You don't have any rules set yet.`,
		ephemeral: true
	});

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
		await interaction.reply({ content: `Captcha Verification has been deployed!`, ephemeral: true });
	} catch (error) {
		console.log(error);
	}
};