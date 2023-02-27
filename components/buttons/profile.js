const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `profile`,
    },
    async execute(interaction) {
        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('inventory')
                    .setEmoji('🛄')
                    .setLabel('Inventory')
                    .setStyle(ButtonStyle.Success),
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

        const member = interaction.user;
        const numFormat = (value) => new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.reply("This user does not have a player profile in this world yet.");

        try {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('**ADVENTURER ID CARD**')
                .setAuthor({ name: `${member.tag}` })
                .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                .addFields(
                    { name: '👤 Player Name', value: `${player.playerName}`, inline: false },
                    { name: '👥 Faction', value: `${player.faction}`, inline: false },
                    { name: '🩸 Health', value: `${player.totalHealth}`, inline: false },
                    { name: '⚔️ Attack', value: `${player.totalAttack}`, inline: true },
                    { name: '🛡️ Defense', value: `${player.totalDefense}`, inline: true },
                    { name: '🗡️ Weapon', value: `${player.weapon}`, inline: false },
                    { name: '💠 Armor', value: `${player.armor}`, inline: false },
                    { name: '💰 Iura', value: `$${numFormat(player.iura.walletAmount)}`, inline: false },
                )
                .setFooter({ text: 'This bot was made by megura.xyz.' });
            
            if (player.imageURL) {
                embed.setImage(`${player.imageURL}`);
            }

            await interaction.reply({
                embeds: [embed],
                components: [button]
            });

        } catch (error) {
            console.log(error);
        }
    }
};