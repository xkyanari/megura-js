// const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: {
        name: `rules`,
    },
    async execute(interaction) {
        await interaction.reply(`I got it!`);
    }
};