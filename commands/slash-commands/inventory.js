const { SlashCommandBuilder } = require('discord.js');
const inventory = require('../../functions/inventory');
const logger = require('../../src/logger');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('Check what you have in your bag.'),
	cooldown: 3000,
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await inventory(interaction);
	},
};
