const { SlashCommandBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { Player, Item, Shop } = require('../../src/db');
const C = require('../../functions/crafting');

const percent = (chance) => `${Math.round(chance * 100)}%`;

const REFUSALS = {
	'not owned': 'You don\'t own that item.',
	'not upgradable': 'Only weapons, armor and accessories can be upgraded.',
	'max': `That item is already at +${C.MAX_UPGRADE}, as strong as it gets.`,
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('upgrade')
		.setDescription(`Upgrade a weapon, armor or accessory (up to +${C.MAX_UPGRADE}).`)
		.addStringOption((option) =>
			option.setName('id').setDescription('Item ID.').setRequired(true).setAutocomplete(true),
		)
		.addBooleanOption((option) =>
			option.setName('ward').setDescription(`Use a Ward Stone: a failed upgrade from +${C.DROP_FROM} up won't lose a level.`),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;
		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) throw new Error('profile not found');

		const result = await C.upgradeItem(player.accountID, options.getString('id'), { ward: options.getBoolean('ward') ?? false });
		if (!result.ok) {
			const { cost } = result;
			const content = REFUSALS[result.reason] ?? {
				'materials': `You need **${cost?.amount} × ${cost?.material}** for this upgrade.`,
				'iura': `You need **${cost?.iura} IURA** for this upgrade.`,
				'no ward': 'You don\'t have a Ward Stone. Craft one with `/craft make`.',
			}[result.reason];
			return interaction.reply({ content, flags: 64 });
		}

		const paid = `(${result.cost.amount} × ${result.cost.material}, ${result.cost.iura} IURA${result.warded ? ', 1 Ward Stone' : ''})`;
		let content;
		if (result.success) content = `✨ Success! **${result.itemName}** is now **+${result.to}**. ${paid}`;
		else if (result.to < result.from) content = `💥 The upgrade failed (${percent(result.chance)} chance), and **${result.itemName}** dropped to **+${result.to}**. ${paid}`;
		else content = `😔 The upgrade failed (${percent(result.chance)} chance). **${result.itemName}** stays at **+${result.to}**${result.warded ? ': the Ward Stone held' : ''}. ${paid}`;
		await interaction.reply({ content, flags: 64 });
	},
	// what the player can upgrade, with the next step's cost and odds
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused().toLowerCase();
		const player = await Player.findOne({ where: { discordID: interaction.user.id, guildID: interaction.guildId } });
		if (!player) return interaction.respond([]);

		const owned = await Item.findAll({ where: { accountID: player.accountID, [Op.or]: [{ quantity: { [Op.gt]: 0 } }, { equippedAmount: { [Op.gt]: 0 } }] } });
		const levels = new Map(owned.map((item) => [item.itemName, item.upgradeLevel]));
		const shopItems = owned.length
			? await Shop.findAll({ where: { guildID: null, category: ['weapons', 'armor', 'miscellaneous'], itemName: [...levels.keys()] } })
			: [];
		const choices = shopItems
			.filter((s) => s.item_ID.toLowerCase().startsWith(focused) || s.itemName.toLowerCase().includes(focused))
			.slice(0, 25)
			.map((s) => {
				const level = levels.get(s.itemName);
				if (level >= C.MAX_UPGRADE) return { name: `${s.itemName} +${level} (max)`, value: s.item_ID };
				const cost = C.upgradeCost(s, level + 1);
				return {
					name: `${s.itemName} +${level} → +${level + 1}: ${cost.amount} × ${cost.material}, ${cost.iura} IURA, ${percent(C.UPGRADE_CHANCE[level])}`.slice(0, 100),
					value: s.item_ID,
				};
			});
		await interaction.respond(choices);
	},
};
