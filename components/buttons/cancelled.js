const { Order, Shop } = require('../../src/db');
const { purchaseStatus } = require('../../functions/webhook');

module.exports = {
	data: {
		name: 'cancelled',
	},
	async execute(interaction) {
        try {
            const shop = await Order.findOne({ where: { messageID: interaction.message.id, guildID: interaction.guild.id } });
            if (shop.status === 'cancelled') return await interaction.reply('This order is already marked as cancelled.');
            
            await Shop.returnOres(shop.itemName, 1, shop.discordID, interaction.guild.id);
            await shop.update({ status: 'cancelled' });
            await interaction.reply('Cancelled!');
            await purchaseStatus(interaction, interaction.guild.id, shop.discordID, shop.itemName, 'Cancelled');
        } catch (error) {
            console.error(error);
        }
	},
};
