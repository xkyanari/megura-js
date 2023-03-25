const { SlashCommandBuilder } = require('discord.js');
const shop = require('../functions/shop');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Purchase items here!'),
    cooldown: 3000,
	async execute(interaction) {
        await shop(interaction);
	}
};