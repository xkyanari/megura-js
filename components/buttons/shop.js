const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: {
        name: `shop`,
    },
    async execute(interaction) {
        
        const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🛒 **ITEM SHOP:** 🛒')
        .setDescription(
            `\n\n__**Basic Sword**__\nTotal Attack: +50\nPrice: 50 IURA\nDescription: A cheap sword for starters.\n\n__**Cheap Bow**__\nTotal Attack: +75\nPrice: 50 IURA\nDescription: Nothing special. Just a cheap bow.\n\n__**Rotten Bandage**__\nTotal Health: +50\nPrice: 75 IURA\nDescription: These were rumored to be stolen from the tombs\nof kings in Aescaphone.__\n\n**Boiled Egg**__\nTotal Health: +100\nTotal Attack: +50\nTotal Defense: +25\nPrice: 150 IURA\nDescription: Small adventurers' favorite.\n\n__**Simple Rock**__\nTotal Attack: +5\nPrice: 1 IURA\nDescription: A rock. Duh.
            `);

            await interaction.reply({
                embeds: [embed],
                components: [
                    {
                        "type": 1,
                        "components": [{
                            "type": 3,
                            "custom_id": "shop",
                            "placeholder": "Choose an item.",
                            "options": [
                                {
                                    "label": "Basic Sword",
                                    "value": "basic_sword",
                                },
                                {
                                    "label": 'Cheap Bow',
                                    "value": 'cheap_bow',
                                },
                                {
                                    "label": 'Rotten Bandage',
                                    "value": 'rotten_bandage',
                                },
                                {
                                    "label": 'Boiled Egg',
                                    "value": 'boiled_egg',
                                },
                                {
                                    "label": 'Simple Rock',
                                    "value": 'rock',
                                }
                            ]
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
                            },
                            {
                                "type": 2,
                                "custom_id": "bank",
                                "emoji": "🏦",
                                "label": "Bank",
                                "style": 1
                            }
                        ]
                    }
                ]
            });
    }
};