const { SlashCommandBuilder } = require('discord.js');
const { runDuel } = require('../../functions/duel');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('duel')
		.setDescription('Request for Duel')
		.addUserOption((option) =>
			option
				.setName('target')
				.setDescription('Choose the player you want to fight.')
				.setRequired(true),
		),
	cooldown: 300000,
	execute(interaction) {
		return runDuel(interaction, interaction.options.getUser('target'));
	},
};
