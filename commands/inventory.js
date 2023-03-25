const { SlashCommandBuilder } = require('discord.js');
const inventory = require('../functions/inventory');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription("Check what you have in your bag."),
    cooldown: 3000,
	async execute(interaction) {
        await inventory(interaction);
	}
};