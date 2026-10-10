const { SlashCommandBuilder } = require('discord.js');
const profile = require('../../functions/profile');
const { requestDeletion } = require('../../functions/deleteProfile');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('View a voyager or delete your own character to start over.')
		.addSubcommand((subcommand) =>
			subcommand.setName('view').setDescription('Show a player\'s profile')
				.addUserOption((option) =>
					option.setName('player').setDescription('Choose the player you want to check.').setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('delete').setDescription('Permanently delete your character in this server and start over.'),
		),
	cooldown: 3000,
	async execute(interaction) {
		if (interaction.options.getSubcommand() === 'delete') return requestDeletion(interaction);
		const member = interaction.options.getUser('player') ?? interaction.user;
		await profile(interaction, member);
	},
};
