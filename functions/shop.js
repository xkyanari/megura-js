const { EmbedBuilder } = require('discord.js');
const { Shop } = require('../src/db');

module.exports = async (interaction) => {
    const numFormat = (value) => new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🛒 **ITEM SHOP:** 🛒')
        .setDescription(`Type \`/buy <item ID> <amount>\` to buy in bulk.`)
        .setFooter({ text: 'This bot was made by megura.xyz.' });

    const shop = await Shop.findAll();

    let itemOptions = [];
    shop.forEach(item => {
        let itemStats = [];
        
        if (item.totalHealth > 0) {
            itemStats.push(`Total Health: ${item.totalHealth}\n`);
        }
        if (item.totalAttack > 0) {
            itemStats.push(`Total Attack: ${item.totalAttack}\n`);
        }
        if (item.totalDefense > 0) {
            itemStats.push(`Total Defense: ${item.totalDefense}\n`);
        }
        itemStats.push(`Price: $${numFormat(item.price)} IURA\n`);
        itemStats.push(`Description: ${item.description}\n`);
        itemStats.push(`Item ID: \`${item.item_ID}\``);
        itemOptions.push({ "label": item.itemName, "value": item.itemName });

        embed.addFields({ name: `__**${item.itemName}**__`, value: itemStats.join(''), inline: false });
    });

    await interaction.reply({
        embeds: [embed],
        components: [
            {
                "type": 1,
                "components": [{
                    "type": 3,
                    "custom_id": "shop",
                    "placeholder": "Choose an item.",
                    "options": itemOptions
                }]
            },
            {
                "type": 1,
                "components": [
                    {
                        "type": 2,
                        "custom_id": "inventory",
                        "emoji": "🛄",
                        "label": "Inventory",
                        "style": 3
                    },
                    {
                        "type": 2,
                        "custom_id": "wallet",
                        "emoji": "💰",
                        "label": "Wallet",
                        "style": 1
                    }
                ]
            }
        ]
    });
};