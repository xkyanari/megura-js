const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `confirm`,
    },
    async execute(interaction) {
        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                .setCustomId('profile')
                .setEmoji('👤')
                .setLabel('Profile')
                .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('inventory')
                    .setEmoji('🛄')
                    .setLabel('Inventory')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                .setCustomId('wallet')
                .setEmoji('💰')
                .setLabel('Wallet')
                .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                .setCustomId('bank')
                .setEmoji('🏦')
                .setLabel('Bank')
                .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                .setCustomId('shop')
                .setEmoji('🛒')
                .setLabel('Shop')
                .setStyle(ButtonStyle.Danger)
            );
        
        const member = interaction.member;
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });
        
        if (player.linked) return interaction.reply({ content: `Your NFT has been linked successfully!`, components: [button]});

            await Player.increment({ totalAttack: 200, totalDefense: 200 }, { where: { discordID: member.id, guildID: guild.id }});
            await Player.update({ linked: 1 }, { where: { discordID: member.id, guildID: guild.id }});
            await interaction.reply({ content: `Your NFT has been linked successfully!`, components: [button]});
    }
};