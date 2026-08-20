const {
	SlashCommandBuilder,
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Create your own profile!'),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
			});

			if (player && player.playerName) {
				return interaction.reply({
					content: 'You\'re all set!',
					ephemeral: true,
				});
			}

			const modal = new ModalBuilder()
				.setCustomId('start')
				.setTitle('Start your Adventure');

			const characterName = new TextInputBuilder()
				.setCustomId('playerName')
				.setLabel('Character Name')
				.setPlaceholder('Up to 20 letters, numbers, and spaces')
				.setStyle(TextInputStyle.Short)
				.setMinLength(1)
				.setMaxLength(20)
				.setRequired(true);

			modal.addComponents(
				new ActionRowBuilder().addComponents(characterName),
			);

			await interaction.showModal(modal);
		}
		catch (error) {
			console.error(error);
		}
	},
};
