const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionsBitField,
} = require('discord.js');
const { Guild } = require('../src/db');

module.exports = async (interaction, channelID) => {
	const message = interaction.client.channels.cache.get(channelID);
	const guild = await Guild.findOne({
		where: { guildID: interaction.guild.id },
	});

	if (
		!message
			.permissionsFor(interaction.client.user)
			.has([
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
			])
	) {
		return await interaction.reply({
			content: 'I don\'t seem to have permissions to send messages on that channel.',
			ephemeral: true,
		});
	}

	if (!guild.intro || !guild.rules || !guild.closing) {
		return interaction.reply({
			content: 'You don\'t have any rules set yet.',
			ephemeral: true,
		});
	}

	const embed = new EmbedBuilder()
		.setTitle(`👋 Welcome to __${interaction.guild.name}__!`)
		.setColor('Aqua').setDescription(`
			${guild.intro}
  
			${guild.rules}
  
			${guild.closing}
		  `);

	const button = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(guild.type)
			.setEmoji('✅')
			.setLabel('Verify')
			.setStyle(ButtonStyle.Success),
	);

	try {
		let sentMessage;
		let sentMessageID = guild.verifyMessageID; // Get the stored message ID

		if (sentMessageID) {
			// If there is a stored message ID, update the existing message
			sentMessage = await message.messages.fetch(sentMessageID);
			await sentMessage.edit({
				embeds: [embed],
				components: [button],
			});
		}
		else {
			sentMessage = await message.send({ embeds: [embed], components: [button] });
			sentMessageID = sentMessage.id; // Update the stored message ID
		}
		await Guild.update(
			{ verifyMessageID: sentMessageID },
			{ where: { guildID: interaction.guild.id } },
		);

		await interaction.reply({
			content: 'Verification message has been deployed!',
			ephemeral: true,
		});
	}
	catch (error) {
		console.log(error);
	}
};
