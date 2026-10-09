const { Op } = require('sequelize');
const { Order, Shop } = require('../../src/db');
const { purchaseStatus } = require('../../functions/webhook');
const { userMention } = require('discord.js');

module.exports = {
	data: {
		name: 'cancelled',
	},
	async execute(interaction) {
		const where = { messageID: interaction.message.id, guildID: interaction.guild.id };
		const shop = await Order.findOne({ where });
		if (!shop) return await interaction.reply({ content: 'Order not found.', flags: 64 });

		// claim the cancellation atomically so a double click can't refund twice
		const [claimed] = await Order.update(
			{ status: 'cancelled' },
			{ where: { ...where, status: { [Op.ne]: 'cancelled' } } },
		);
		if (!claimed) return await interaction.reply('This order is already marked as cancelled.');

		let refunded;
		try {
			refunded = await Shop.returnOres(shop.itemName, 1, shop.discordID, interaction.guild.id);
		}
		catch (error) {
			// refund failed: put the order back so it can be cancelled again
			await Order.update({ status: shop.status }, { where });
			throw error;
		}

		const note = refunded ? '' : '\nThe buyer no longer has a profile, so no ores were refunded.';
		await interaction.reply(`Cancelled by ${userMention(interaction.user.id)}!${note}`);
		await purchaseStatus(interaction.guild.id, shop.discordID, shop.itemName, 'Cancelled');
	},
};
