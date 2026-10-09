const { SlashCommandBuilder } = require('discord.js');
const { transferToPlayer } = require('../../functions/transfer');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('transfer')
		.setDescription('Transfer Iura to another player.')
		.addUserOption((option) =>
			option
				.setName('player')
				.setDescription('Select player.')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('Enter amount.')
				.setMinValue(1)
				.setRequired(true),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const recipient = interaction.options.getUser('player');
		const amount = interaction.options.getInteger('amount');

		await transferToPlayer(interaction, recipient, amount);
	},
};
