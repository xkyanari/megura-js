const { Order } = require('../../src/db');
const { purchaseStatus } = require('../../functions/webhook');

module.exports = {
	data: {
		name: 'processing',
	},
	async execute(interaction) {
        try {
            const shop = await Order.findOne({ where: { messageID: interaction.message.id, guildID: interaction.guild.id } });
            if (shop.status === 'processing') return await interaction.reply('This order is already marked as processing.');
            
            await shop.update({ status: 'processing' });
            await interaction.reply(`Processing by ${userMention(interaction.user.id)}!`);
            await purchaseStatus(interaction.guild.id, shop.discordID, shop.itemName, 'Processing');
        } catch (error) {
            console.error(error);
        }
	},
};
