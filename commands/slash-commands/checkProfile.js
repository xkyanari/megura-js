const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const profile = require('../../functions/profile');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('View Profile')
		.setType(ApplicationCommandType.User),
	cooldown: 3000,
	async execute(interaction) {
		await profile(interaction, interaction.targetUser);
	},
};