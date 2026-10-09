const { SlashCommandBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { Player, Item, Shop } = require('../../src/db');
const { sellItem, sellPrice, SELL_SHARE } = require('../../functions/sell');

const REFUSALS = {
	'amount': 'Please enter an amount of at least 1.',
	'not found': 'The shop doesn\'t buy that item.',
	'not enough': 'You don\'t have that many to sell. Equipped items have to be unequipped first.',
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('sell')
		.setDescription(`Sell items back to the shop for ${SELL_SHARE * 100}% of their price.`)
		.addStringOption((option) =>
			option.setName('id').setDescription('Item ID.').setRequired(true).setAutocomplete(true),
		)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription('How many (default 1).').setMinValue(1),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;

		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) {
			throw new Error('profile not found');
		}

		const amount = options.getInteger('amount') ?? 1;
		const result = await sellItem(player.accountID, options.getString('id'), amount);
		if (!result.ok) {
			return interaction.reply({ content: REFUSALS[result.reason], flags: 64 });
		}
		await interaction.reply({ content: `💰 You sold ${amount} × \`${result.itemName}\` for **${result.total} IURA**.`, flags: 64 });
	},
	// suggests what the player can actually sell, with the price
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused().toLowerCase();
		const player = await Player.findOne({ where: { discordID: interaction.user.id, guildID: interaction.guildId } });
		if (!player) return interaction.respond([]);

		const owned = await Item.findAll({ where: { accountID: player.accountID, quantity: { [Op.gt]: 0 } } });
		const shopItems = owned.length
			? await Shop.findAll({ where: { guildID: null, itemName: owned.map((item) => item.itemName) } })
			: [];
		const quantities = new Map(owned.map((item) => [item.itemName, item.quantity]));
		const choices = shopItems
			.filter((s) => s.item_ID.toLowerCase().startsWith(focused) || s.itemName.toLowerCase().includes(focused))
			.slice(0, 25)
			.map((s) => ({
				name: `${s.itemName} ×${quantities.get(s.itemName)} (${sellPrice(s.price)} IURA each)`.slice(0, 100),
				value: s.item_ID,
			}));
		await interaction.respond(choices);
	},
};
