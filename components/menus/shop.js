const { Player, Iura, Shop, Item } = require('../../src/db');

async function getItems(interaction, item_name) {
    const member = interaction.member;
    const guild = interaction.guild;
    
    try {
        // get the item_id from the database
        const { itemID, totalHealth, totalAttack, totalDefense, price } = await Shop.findOne({ where: { itemName: item_name }});

        // lookup the player data
        const currentPlayer = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        const lookup = await Item.findOne({ where: { itemName: item_name, accountID: currentPlayer.accountID }});

        if (lookup) {
            // pull the amount from its wallet
            await Iura.decrement({ walletAmount: price }, { where: { accountID: currentPlayer.iura.accountID } });

            // updates the quantity of the item
            await Item.increment({ quantity: 1 }, { where: { itemName: item_name, accountID: currentPlayer.accountID } });
            await Player.increment({ totalHealth, totalAttack, totalDefense }, { where: { accountID: currentPlayer.accountID }});
            await interaction.editReply(`\`${item_name}\` has been purchased.`);
        } else{
            // pull the amount from its wallet
            await Iura.decrement({ walletAmount: price }, { where: { accountID: currentPlayer.iura.accountID } });
        
            // else, create item data assigned to player
            await currentPlayer.createItem({ itemID, itemName: item_name, quantity: 1 });
        
            // also update the player's stats
            await Player.increment({ totalHealth, totalAttack, totalDefense }, { where: { accountID: currentPlayer.accountID }});
            await interaction.editReply(`\`${item_name}\` has been purchased.`);
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

        await getItems(interaction, selected);
    }
};