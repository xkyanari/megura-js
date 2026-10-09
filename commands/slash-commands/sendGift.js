const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { transferToPlayer } = require('../../functions/transfer');

const GIFT_AMOUNT = 30;

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Transfer IURA')
		.setType(ApplicationCommandType.User),
	cooldown: 3000,
	async execute(interaction) {
		await transferToPlayer(interaction, interaction.targetUser, GIFT_AMOUNT);
	},
};
