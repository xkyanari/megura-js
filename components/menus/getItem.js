const { notifyPurchase } = require('../../functions/webhook');
const { Player, Shop } = require('../../src/db');

module.exports = {
	data: {
		name: 'getItem',
	},
	async execute(interaction) {
		const member = interaction.member;
		const guild = interaction.guild;

		const selected = await interaction.values[0];
		await interaction.deferReply({ flags: 64 });

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});
		if (!player) {
			throw new Error('profile not found');
		}

		const shopItem = await Shop.findOne({ where: { itemName: selected } });
		if (!shopItem) return interaction.editReply('Item not found.');

		const { price, guildID } = shopItem;

		try {
			if (guildID) {
				// guild items are paid in ores and fulfilled by the server team
				await Shop.buyItem(selected, 1, member.id, guild.id);
				await notifyPurchase(guild.id, member.id, selected);
				return await interaction.editReply(`\`${selected}\` has been purchased.\nThe team has been notified for your purchase and will update you once it's complete.`);
			}

			await player.spendIura(price);
		}
		catch (error) {
			if (error.message === 'insufficient funds') {
				return interaction.editReply('You do not have sufficient balance!');
			}
			if (error.message === 'out of stock') {
				return interaction.editReply(`\`${selected}\` is sold out!`);
			}
			throw error;
		}

		await player.addItem(selected);
		await player.increment({ iuraSpent: price });

		await interaction.editReply(`\`${selected}\` has been purchased.`);
	},
};
