const { SlashCommandBuilder } = require('discord.js');
const { solscanApiToken } = require('../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('solana')
		.setDescription('Solana Test'),
    cooldown: 3000,
	async execute(interaction) {
        const tokenAddress = '14a7mjhoMZfkHeCNyNzNyigtftgFWNL1LTfCZhdE5QiQ';

        const options = {
        method: 'GET',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'token': solscanApiToken
        }};

        fetch(`https://pro-api.solscan.io/v1.0/nft/token/info/${tokenAddress}`, options)
        .then(response => response.json())
        .then(response => console.log(response.data[0].nft_attributes))
        .catch(err => console.error(err));

        await interaction.reply(`Test successful!`);
	}
};