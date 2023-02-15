const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription('Purchase items here!'),
	async execute(interaction) {
        // const button = new ButtonBuilder()
        //     .setCustomId('sample-button')
        //     .setLabel('Click Me!')
        //     .setStyle(ButtonStyle.Primary);
        
        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop-menu')
            .setPlaceholder('Choose an item.')
            .addOptions(
                {
                    label: 'Basic Sword',
                    value: 'basic_sword',
                },
                {
                    label: 'Cheap Bow',
                    value: 'cheap_bow',
                },
                {
                    label: 'Rotten Bandage',
                    value: 'rotten_bandage',
                },
                {
                    label: 'Boiled Egg',
                    value: 'boiled_egg',
                },
                {
                    label: 'Simple Rock',
                    value: 'rock',
                },
            );
        
        const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🏬 **ITEM SHOP:** 🏬')
        .setDescription(
            `\n\n__**Basic Sword**__\nTotal Attack: +50\nPrice: 50 IURA\nDescription: A cheap sword for starters.\n\n__**Cheap Bow**__\nTotal Attack: +75\nPrice: 50 IURA\nDescription: Nothing special. Just a cheap bow.\n\n__**Rotten Bandage**__\nTotal Health: +50\nPrice: 75 IURA\nDescription: These were rumored to be stolen from the tombs of kings in Aescaphone.__\n\n**Boiled Egg**__\nTotal Health: +100\nTotal Attack: +50\nTotal Defense: +25\nPrice: 150 IURA\nDescription: Small adventurers' favorite.\n\n__**Simple Rock**__\nTotal Attack: +5\nPrice: 1 IURA\nDescription: A rock. Duh.
            `);

        await interaction.reply({
            // content: 'This is a test',
            embeds: [embed],
            components: [new ActionRowBuilder().addComponents(menu)]
        });
	}
};