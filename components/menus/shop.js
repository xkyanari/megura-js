const { Player, Iura, Shop, Item } = require('../../src/db');

async function getItems(interaction, item_id) {
    const member = interaction.member;
    const guild = interaction.guild;
    
    try {
        // get the item_id from the database
        const { itemName, totalHealth, totalAttack, totalDefense, price } = await Shop.findOne({ where: { itemID: item_id }});

        // lookup the player data
        const currentPlayer = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        const lookup = await Item.findOne({ where: { itemID: item_id, accountID: currentPlayer.accountID }});

        if (lookup) {
            await interaction.editReply(`This item already exists in your inventory!`);
        } else{
            // pull the amount from its wallet
            await Iura.decrement({ walletAmount: price }, { where: { accountID: currentPlayer.iura.accountID } });
    
            await interaction.editReply(`\`${itemName}\` has been purchased.`);
        
            // else, create item data assigned to player
            await currentPlayer.createItem({ itemID: item_id, itemName, quantity: 1 });
        
            // also update the player's stats
            await Player.increment({ totalHealth, totalAttack, totalDefense }, { where: { accountID: currentPlayer.accountID }});
        }
    } catch (error) {
        console.log(error);
    }
};

module.exports = {
    data: {
        name: `shop`,
    },
    async execute(interaction) {
                
        const selected = await interaction.values[0];
        await interaction.deferReply();

        if (selected === 'basic_sword') {
            await getItems(interaction, 1);
        } else if (selected === 'cheap_bow') {
            await getItems(interaction, 3);
        } else if (selected === 'rotten_bandage') {
            await getItems(interaction, 4);
        } else if (selected === 'boiled_egg') {
            await getItems(interaction, 5);
        } else if (selected === 'rock') {
            await getItems(interaction, 6);
        }
    }
};