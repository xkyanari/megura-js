const { EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { Shop } = require('../../src/db');
const { footer } = require('../../src/vars');
const buttonPages = require('../../functions/paginator');

module.exports = {
	data: {
		name: 'category',
	},
	async execute(interaction) {
		const selected = await interaction.values[0];
		await interaction.deferUpdate();

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

		const categoryToEmoji = {
			'weapons': '🗡️',
			'armor': '🛡️',
			'consumables': '🍔',
			'miscellaneous': '🔮',
		};

		try {
			const itemList = await Shop.findAll({
				where: { category: selected },
				order: [
					['level', 'ASC'],
				],
			});

			if (itemList.length === 0) return;

			const pages = [];
			const optionsPages = [];
			for (let i = 0; i < itemList.length; i += 4) {
				const embed = new EmbedBuilder()
					.setColor(0xcd7f32)
					.setTitle('🛒 **ITEM SHOP:** 🛒')
					.setDescription('Type `/buy <item ID> <amount>` to buy in bulk.')
					.setFooter(footer);

				const slicedItems = itemList.slice(i, i + 4);
				const itemOptions = slicedItems.map(item => ({ label: item.itemName, value: item.itemName }));
				optionsPages.push(itemOptions);

				slicedItems.forEach((item) => {
					const emoji = categoryToEmoji[item.category] || '🔍';
					const itemStats = [];
					if (item.totalHealth > 0) {
						itemStats.push(`Total Health: ${item.totalHealth}\n`);
					}
					if (item.totalAttack > 0) {
						itemStats.push(`Total Attack: ${item.totalAttack}\n`);
					}
					if (item.totalDefense > 0) {
						itemStats.push(`Total Defense: ${item.totalDefense}\n`);
					}
					if (item.description) {
						itemStats.push(`Description: ${item.description}\n`);
					}
					itemStats.push(`Level: ${item.level}\n`);
					itemStats.push(`Price: $${numFormat(item.price)} IURA\n`);
					itemStats.push(`Item ID: \`${item.item_ID}\``);

					embed.addFields({
						name: `${emoji} __**${item.itemName}**__`,
						value: itemStats.join(''),
						inline: false,
					});

				});

				pages.push(embed);
			}

			const selectMenu = new StringSelectMenuBuilder()
				.setCustomId('getItem')
				.setPlaceholder('Choose an item.')
				.addOptions(optionsPages[0]);

			await buttonPages(interaction, pages, selectMenu, optionsPages);
		}
		catch (error) {
			console.log(error);
		}
	},
};
