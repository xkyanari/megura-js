const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `confirm`,
    },
    async execute(interaction) {
        const userData = interaction.client.userData.get(interaction.user.id);

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
                .setCustomId('shop')
                .setEmoji('🛒')
                .setLabel('Shop')
                .setStyle(ButtonStyle.Danger)
            );
        
        const member = interaction.member;
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        player.weapon = userData.weapon;
        player.armor = userData.armor;
        player.walletAddress = userData.walletAddress;
        player.tokenID = userData.tokenID;
        player.imageURL = userData.imageURL;

        if (player.linked === 1) return interaction.reply({ content: `Your NFT has been linked successfully!`, components: [button]});

        player.totalAttack += 200;
        player.totalDefense += 200;
        player.linked = 1;

        interaction.client.userData.delete(interaction.user.id);

        await interaction.reply({ content: `Your NFT has been linked successfully!`, components: [button]});

        return player.save();
    }
};