const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = async (interaction) => {
	const rules = new ModalBuilder()
        .setCustomId('rules')
        .setTitle('Rules');

    const rule1 = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('rule1')
            .setLabel('Enter Rule #1')
            .setStyle(TextInputStyle.Short));
    
    const rule2 = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('rule2')
            .setLabel('Enter Rule #2')
            .setStyle(TextInputStyle.Short));
    
    const rule3 = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('rule3')
            .setLabel('Enter Rule #3')
            .setStyle(TextInputStyle.Short));
    
    const rule4 = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('rule4')
            .setLabel('Enter Rule #4')
            .setStyle(TextInputStyle.Short));
    
    const rule5 = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('rule5')
            .setLabel('Enter Rule #5')
            .setStyle(TextInputStyle.Short));
    
    rules.addComponents(rule1, rule2, rule3, rule4, rule5);

    await interaction.showModal(rules);
};