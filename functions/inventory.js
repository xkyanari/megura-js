const { EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = async (interaction) => {
    const member = interaction.member;
    const guild = interaction.guild;

    const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'item' });
    const items = await player.getItems();

    if (!player) return interaction.reply("This user does not have a player profile in this world yet.");

        try {
            const embed = new EmbedBuilder()
                .setColor(0xCD7F32)
                .setAuthor({ name: `${interaction.user.tag}` })
                .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                .setTitle('**🛄 INVENTORY LIST**')
                .setFooter({ text: 'This bot was made by megura.xyz.' });
            
            if (items.length === 0) {
                embed.addFields({name: `\u200b`, value: `Nothing here!`, inline: false });
            }
            items.forEach(item => {
                embed.addFields({name: item.itemName, value: `Quantity: ${item.quantity}`, inline: false });
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.log(error);
        }
};