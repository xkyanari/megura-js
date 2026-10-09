const { EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
const { Shop } = require('../../src/db');
const { footer } = require('../../src/vars');
const buttonPages = require('../../functions/paginator');

// Items per page (Discord allows at most 25 embed fields and 25 menu options).
const PAGE_SIZE = 10;

module.exports = {
	data: {
		name: 'specialshopCategory',
	},
	async execute(interaction) {
		const selected = await interaction.values[0];
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
		// a private reply to page through, so the shop panel stays as it is for everyone else
		await interaction.deferReply({ flags: 64 });

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

		const itemList = await Shop.findAll({
			where: { category: selected, guildID: interaction.guild.id },
			order: [
				['level', 'ASC'],
			],
		});

		if (itemList.length === 0) {
			return interaction.editReply('Nothing in this category yet.');
		}

		const pageCount = Math.ceil(itemList.length / PAGE_SIZE);
		const pages = [];
		const optionPages = [];
		for (let i = 0; i < itemList.length; i += PAGE_SIZE) {
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle(`${oreEmoji} **SPECIAL SHOP:** ${oreEmoji}`)
				.setFooter(footer);
			if (pageCount > 1) embed.setDescription(`Page ${i / PAGE_SIZE + 1} of ${pageCount}`);

			const pageItems = itemList.slice(i, i + PAGE_SIZE);
			optionPages.push(pageItems.map((item) => ({ label: item.itemName, value: item.itemName })));
			for (const item of pageItems) {
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
				itemStats.push(`Price: ${numFormat(item.price)} ${oreEmoji}\n`);
				itemStats.push(`Quantity: ${item.quantity > 0 ? item.quantity : '**SOLD OUT**'}\n`);

				embed.addFields({
					name: `__**${item.itemName}**__`,
					value: itemStats.join(''),
					inline: false,
				});
			}
			pages.push(embed);
		}

		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('getItem')
			.setPlaceholder('Choose an item.')
			.addOptions(optionPages[0]);

		await buttonPages(interaction, pages, selectMenu, optionPages);
	},
};
