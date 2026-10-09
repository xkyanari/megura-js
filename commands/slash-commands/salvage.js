const { SlashCommandBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { Player, Item, Shop } = require('../../src/db');
const { salvageItem, MIN_SALVAGE_PRICE } = require('../../functions/crafting');

const REFUSALS = {
	'amount': 'Please enter an amount of at least 1.',
	'not found': 'There is no such item.',
	'not salvageable': `Only weapons, armor and accessories worth at least ${MIN_SALVAGE_PRICE} IURA can be salvaged.`,
	'not enough': 'You don\'t have that many. Equipped items have to be unequipped first.',
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('salvage')
		.setDescription('Break gear you don\'t need into crafting materials.')
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
		if (!player) throw new Error('profile not found');

		const amount = options.getInteger('amount') ?? 1;
		const result = await salvageItem(player.accountID, options.getString('id'), amount);
		if (!result.ok) return interaction.reply({ content: REFUSALS[result.reason], flags: 64 });
		const gained = result.gained.map((g) => `${g.amount} × ${g.item}`).join(', ');
		await interaction.reply({ content: `🔨 You salvaged ${amount} × \`${result.itemName}\` into ${gained}.`, flags: 64 });
	},
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused().toLowerCase();
		const player = await Player.findOne({ where: { discordID: interaction.user.id, guildID: interaction.guildId } });
		if (!player) return interaction.respond([]);
		const owned = await Item.findAll({ where: { accountID: player.accountID, quantity: { [Op.gt]: 0 } } });
		const quantities = new Map(owned.map((item) => [item.itemName, item.quantity]));
		const shopItems = owned.length
			? await Shop.findAll({ where: { guildID: null, category: ['weapons', 'armor', 'miscellaneous'], itemName: [...quantities.keys()] } })
			: [];
		await interaction.respond(shopItems
			.filter((s) => s.price >= MIN_SALVAGE_PRICE)
			.filter((s) => s.item_ID.toLowerCase().startsWith(focused) || s.itemName.toLowerCase().includes(focused))
			.slice(0, 25)
			.map((s) => ({ name: `${s.itemName} ×${quantities.get(s.itemName)}`.slice(0, 100), value: s.item_ID })));
	},
};
