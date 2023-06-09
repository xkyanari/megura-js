const { SlashCommandBuilder } = require('discord.js');
const shop = require('../../functions/shop');
const logger = require('../../src/logger');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Purchase items here!'),
	cooldown: 3000,
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await shop(interaction);
	},
};
