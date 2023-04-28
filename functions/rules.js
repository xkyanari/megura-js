const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = async (interaction) => {
	const rule = new ModalBuilder()
        .setCustomId('rules')
        .setTitle('Rules');

    const intro = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('intro')
            .setLabel('Enter your introduction about the server.')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(300));

    const rules = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('rules')
            .setLabel('Enumerate the rules.')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(1000));
    
    const closing = new ActionRowBuilder()
    .addComponents(
        new TextInputBuilder()
            .setCustomId('closing')
            .setLabel('Enter closing.')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500));
    
    rule.addComponents(intro, rules, closing);

    await interaction.showModal(rule);
};