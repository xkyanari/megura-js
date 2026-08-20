const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionsBitField,
} = require('discord.js');
const { Guild } = require('../src/db');

module.exports = async (interaction, channelID) => {
	const respond = async (options) => {
		if (interaction.deferred || interaction.replied) {
			return interaction.editReply(options);
		}
		return interaction.reply(options);
	};

	const guild = await Guild.findOne({
		where: { guildID: interaction.guild.id },
	});

	if (!guild) {
		return respond({
			content: 'This server is not registered yet. Please run `/setup register` first.',
			flags: 64,
		});
	}

	if (!channelID || !guild.verifyRoleID || !guild.type) {
		return respond({
			content: 'CAPTCHA is not configured yet. Please run `/setup captcha` first.',
			flags: 64,
		});
	}

	const verifyChannel = await interaction.guild.channels.fetch(channelID).catch(() => null);

	if (!verifyChannel || !verifyChannel.isTextBased()) {
		return respond({
			content: 'The configured verification channel could not be found. Please run `/setup captcha` again with a valid text channel.',
			flags: 64,
		});
	}

	const permissions = verifyChannel.permissionsFor(interaction.client.user);
	if (
		!permissions
			|| !permissions.has([
				PermissionsBitField.Flags.ViewChannel,
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.EmbedLinks,
				PermissionsBitField.Flags.ReadMessageHistory,
			])
	) {
		return respond({
			content: 'I need View Channel, Send Messages, Embed Links, and Read Message History permissions in the configured verification channel.',
			flags: 64,
		});
	}

	if (!guild.intro || !guild.rules || !guild.closing) {
		return respond({
			content: 'You don\'t have any rules set yet. Please run `/setup rules` before `/setup deploy`.',
			flags: 64,
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
			sentMessage = await verifyChannel.messages.fetch(sentMessageID).catch(() => null);
			if (sentMessage) {
				await sentMessage.edit({
					embeds: [embed],
					components: [button],
				});
			}
		}

		if (!sentMessage) {
			sentMessage = await verifyChannel.send({ embeds: [embed], components: [button] });
			sentMessageID = sentMessage.id; // Update the stored message ID
		}

		await Guild.update(
			{ verifyMessageID: sentMessageID },
			{ where: { guildID: interaction.guild.id } },
		);

		await respond({
			content: 'Verification message has been deployed!',
			flags: 64,
		});
	}
	catch (error) {
		console.log(error);
		await respond({
			content: 'I could not deploy the verification message. Please check my permissions and try again.',
			flags: 64,
		});
	}
};
