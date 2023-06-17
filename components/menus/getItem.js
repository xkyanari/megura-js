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
		await interaction.deferReply({ ephemeral: true });

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
				include: 'iura',
			});
			const { price, guildID, quantity } = await Shop.findOne({ where: { itemName: selected } });

			if (!player) {
				throw new Error('profile not found');
			}

			if (price > player.iura.walletAmount) return interaction.editReply('You do not have sufficient balance!');

			if (guildID && quantity === 0) return await interaction.editReply({ content: `\`${selected}\` is sold out!` });

			if (guildID && price > player.oresEarned) return interaction.editReply('You do not have sufficient balance!');

			if (guildID) {
				await Shop.buyItem(selected, 1, interaction.member.id, interaction.guild.id);
				await notifyPurchase(interaction, interaction.guild.id, interaction.member.id, selected);
				return await interaction.editReply(`\`${selected}\` has been purchased.\nThe team has been notified for your purchase and will update you once it's complete.`);
			}

			await player.withdraw(-price);
			await player.addItem(selected);
			await Player.increment(
				{ iuraSpent: price },
				{ where: { discordID: member.id } },
			);

			await interaction.editReply(`\`${selected}\` has been purchased.`);
		}
		catch (error) {
			console.log(error);
		}
	},
};
