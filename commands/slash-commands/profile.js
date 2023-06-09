const { SlashCommandBuilder } = require('discord.js');
const profile = require('../../functions/profile');
const logger = require('../../src/logger');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('Show a player\'s profile')
		.addUserOption((option) =>
			option
				.setName('player')
				.setDescription('Choose the player you want to check.')
				.setRequired(false),
		),
	cooldown: 3000,
	async execute(interaction) {
		const getPlayer = interaction.options.getUser('player');
		const member = getPlayer === null ? interaction.user : getPlayer;

		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await profile(interaction, member);
	},
};
