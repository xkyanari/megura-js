const { purchaseStatus } = require('../../functions/webhook');
const { Order, Player } = require('../../src/db');
const { userMention } = require('discord.js');

module.exports = {
	data: {
		name: 'completed',
	},
	async execute(interaction) {
        try {
            const shop = await Order.findOne({ where: { messageID: interaction.message.id, guildID: interaction.guild.id } });
            if (shop.status === 'completed') return await interaction.reply('This order is already marked as completed.');
            
            const player = await Player.findOne({ where: { discordID: shop.discordID, guildID: interaction.guild.id }});
            await player.addItem(shop.itemName);
            await shop.update({ status: 'completed' });
            await interaction.reply(`Completed by ${userMention(interaction.user.id)}!`);
            await purchaseStatus(interaction.guild.id, shop.discordID, shop.itemName, 'Completed');
        } catch (error) {
            console.error(error);
        }
	},
};
