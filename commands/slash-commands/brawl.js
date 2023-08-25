const {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');
const { footer, brawlImage } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('brawl')
		.setDescription('Put a notice board for challenges.'),
	cooldown: 10000,
	async execute(interaction) {
		try {
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle('⚔️ **BRAWL:** ⚔️')
				.setDescription('Challenge voyagers for a brawl here!')
				.setImage(brawlImage)
				.setFooter(footer);

			const button = new ButtonBuilder()
				.setCustomId('brawl-start')
				.setLabel('Start a Brawl')
				.setStyle(ButtonStyle.Primary);

			const row = new ActionRowBuilder()
				.addComponents(button);

			await interaction.reply({
				embeds: [embed],
				components: [row],
			});
		}
		catch (error) {
			console.error(error);
		}
	},
};
