const {
	SlashCommandBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const { Player } = require('../../src/db');
const logger = require('../../src/logger');
const { checkProfile } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('changenick')
		.setDescription('Update your profile'),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;
		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});

		logger.log({
			level: 'info',
			message: `User: ${member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		if (!player) {
			return interaction.reply({
				content: checkProfile,
				ephemeral: true,
			});
		}

		const modal = new ModalBuilder()
			.setCustomId('changenick')
			.setTitle('Update Character Name');

		const characterName = new TextInputBuilder()
			.setCustomId('playerName')
			.setLabel('Character Name')
			.setPlaceholder(player.playerName || 'Up to 20 letters, numbers, and spaces')
			.setStyle(TextInputStyle.Short)
			.setMinLength(1)
			.setMaxLength(20)
			.setRequired(true);

		modal.addComponents(
			new ActionRowBuilder().addComponents(characterName),
		);

		await interaction.showModal(modal);
	},
};
