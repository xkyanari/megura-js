const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { runDuel } = require('../../functions/duel');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Request for Duel')
		.setType(ApplicationCommandType.User),
	cooldown: 300000,
	execute(interaction) {
		return runDuel(interaction, interaction.targetUser);
	},
};
