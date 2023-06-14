const { SlashCommandBuilder } = require('discord.js');
const { executeAttack } = require('../../functions/attack');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('attack')
		.setDescription('Attack a random monster'),
	cooldown: 25000,
	async execute(interaction) {

		await executeAttack(interaction);
	},
};
