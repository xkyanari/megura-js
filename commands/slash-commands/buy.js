const { SlashCommandBuilder } = require('discord.js');
const { Player, Shop } = require('../../src/db');
const logger = require('../../src/logger');
const { checkProfile } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('buy')
		.setDescription('Buy items in bulk')
		.addStringOption((option) =>
			option.setName('id').setDescription('Enter item ID.').setRequired(true),
		)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription('Enter amount.').setRequired(true),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;
		const id = interaction.options.getString('id');
		const amount = interaction.options.getInteger('amount');

		logger.log({
			level: 'info',
			message: `User: ${member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
				include: 'iura',
			});
			const { price, itemName } = await Shop.findOne({
				where: { item_ID: id },
			});

			if (!player) {
				return interaction.reply({
					content: checkProfile,
					ephemeral: true,
				});
			}
			if (price * amount > player.iura.walletAmount) {
				return interaction.reply({
					content: 'You do not have sufficient balance!',
					ephemeral: true,
				});
			}
			if (amount <= 0) {
				return interaction.reply({
					content: 'Item quantity entered should be at least 1.',
					ephemeral: true,
				});
			}

			await player.withdraw(-(price * amount));
			await player.addItem(itemName, amount);
			// await player.updateStats(itemName, amount);
			await Player.increment(
				{ iuraSpent: price },
				{ where: { discordID: member.id } },
			);

			await interaction.reply(`\`${itemName}\` has been purchased.`);
		}
		catch (error) {
			console.error(error);
		}
	},
};
