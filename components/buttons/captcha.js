const { SlashCommandBuilder } = require('discord.js');
const verify = require('../../functions/captcha');

module.exports = {
	data: {
        name: `captcha`,
    },
	async execute(interaction) {
		await verify(interaction);
	}
};