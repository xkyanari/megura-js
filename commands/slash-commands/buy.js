const { SlashCommandBuilder } = require('discord.js');
const { Player, Shop } = require('../../src/db');
const { isForSale } = require('../../functions/crafting');
const fs = require('fs');
const path = require('node:path');

const itemsData = fs.readFileSync(path.join(__dirname, '../../assets/item_db.json'));
const itemsJson = JSON.parse(itemsData).filter(isForSale);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('buy')
		.setDescription('Buy items in bulk')
		.addStringOption((option) =>
			option
				.setName('id')
				.setDescription('Enter item ID.')
				.setRequired(true)
				.setAutocomplete(true),
		)
		.addIntegerOption((option) =>
			option
				.setName('amount')
				.setDescription('Enter amount.')
				.setMinValue(1)
				.setRequired(true),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;
		const id = interaction.options.getString('id');
		const amount = interaction.options.getInteger('amount');

		if (amount <= 0) {
			return interaction.reply({
				content: 'Item quantity entered should be at least 1.',
				flags: 64,
			});
		}

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});
		if (!player) {
			throw new Error('profile not found');
		}

		// /buy is for the global shop; special-shop items go through the shop menu and orders
		const shopItem = await Shop.findOne({ where: { item_ID: id, guildID: null } });
		if (!shopItem) {
			return interaction.reply({ content: 'Item not found.', flags: 64 });
		}
		if (!isForSale(shopItem)) {
			return interaction.reply({ content: 'That item isn\'t sold: it can only be crafted or found.', flags: 64 });
		}

		const { price, itemName } = shopItem;
		const total = price * amount;

		try {
			await player.spendIura(total);
		}
		catch (error) {
			if (error.message === 'insufficient funds') {
				return interaction.reply({
					content: 'You do not have sufficient balance!',
					flags: 64,
				});
			}
			throw error;
		}

		await player.addItem(itemName, amount);
		await player.increment({ iuraSpent: total });

		await interaction.reply(`\`${itemName}\` has been purchased.`);
	},
	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused();
		const choices = itemsJson.map(item => item.item_ID);
		const filtered = choices.filter(choice => choice.startsWith(focusedValue)).slice(0, 5);

		await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
	},
};
