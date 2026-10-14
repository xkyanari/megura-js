const { Player, Shop } = require('../../src/db');
const { isForSale } = require('../../functions/crafting');

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

		const shopItem = await Shop.findOne({ where: { itemName: selected, guildID: null } });
		if (!shopItem) return interaction.editReply('Item not found.');
		if (!shopItem.guildID && !isForSale(shopItem)) return interaction.editReply('That item isn\'t sold: it can only be crafted or found.');

		const { price } = shopItem;

		try {

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
