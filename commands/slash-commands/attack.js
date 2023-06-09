const { SlashCommandBuilder } = require('discord.js');
const logger = require('../../src/logger');
const { executeAttack } = require('../../functions/attack');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('attack')
		.setDescription('Attack a random monster'),
	cooldown: 25000,
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await executeAttack(interaction);
	},
};
