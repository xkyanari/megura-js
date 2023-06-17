const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Shop } = require('../../src/db');
const { footer } = require('../../src/vars');

module.exports = {
    data: {
        name: 'specialshopCategory',
    },
    async execute(interaction) {
        const selected = await interaction.values[0];
        const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
        await interaction.deferUpdate({ ephemeral: true });

        const numFormat = (value) =>
            new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

        try {
            const itemList = await Shop.findAll({
                where: { category: selected, guildID: interaction.guild.id },
            });

            if (itemList.length === 0) return;

            const embed = new EmbedBuilder()
                .setColor(0xcd7f32)
                .setTitle(`${oreEmoji} **SPECIAL SHOP:** ${oreEmoji}`)
                .setFooter(footer);

            const itemOptions = [];
            itemList.forEach((item) => {
                const itemStats = [];
                if (item.totalHealth > 0) {
                    itemStats.push(`Total Health: ${item.totalHealth}\n`);
                }
                if (item.totalAttack > 0) {
                    itemStats.push(`Total Attack: ${item.totalAttack}\n`);
                }
                if (item.totalDefense > 0) {
                    itemStats.push(`Total Defense: ${item.totalDefense}\n`);
                }
                if (item.description) {
                    itemStats.push(`Description: ${item.description}\n`);
                }
                itemStats.push(`Price: ${numFormat(item.price)} ${oreEmoji}\n`);
                itemStats.push(`Quantity: ${item.quantity > 0 ? item.quantity : '**SOLD OUT**'}\n`);
                itemOptions.push({ label: item.itemName, value: item.itemName });

                embed.addFields({
                    name: `__**${item.itemName}**__`,
                    value: itemStats.join(''),
                    inline: false,
                });
            });

            const select1 = new StringSelectMenuBuilder()
                .setCustomId('getItem')
                .setPlaceholder('Choose an item.')
                .addOptions(itemOptions);

            const row1 = new ActionRowBuilder()
                .addComponents(select1);
                
            return await interaction.followUp({
                embeds: [embed],
                components: [row1],
                ephemeral: true,
            });
        }
        catch (error) {
            console.log(error);
        }
    },
};
