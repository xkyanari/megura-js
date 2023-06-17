const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Shop } = require('../../src/db');
const { footer } = require('../../src/vars');

module.exports = {
	data: {
		name: 'category',
	},
	async execute(interaction) {
		const selected = await interaction.values[0];
		await interaction.deferUpdate();

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

		try {
			const itemList = await Shop.findAll({
				where: { category: selected },
			});

			if (itemList.length === 0) return;

			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle('🛒 **ITEM SHOP:** 🛒')
				.setFooter(footer);

			const button = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('profile')
					.setEmoji('👤')
					.setLabel('Profile')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId('inventory')
					.setEmoji('🛄')
					.setLabel('Inventory')
					.setStyle(ButtonStyle.Primary),
			);

			const itemOptions = [];
			itemList.forEach((item) => {
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
				itemOptions.push({ label: item.itemName, value: item.itemName });

				embed.addFields({
					name: `__**${item.itemName}**__`,
					value: itemStats.join(''),
					inline: false,
				});
			});

			const select1 = new StringSelectMenuBuilder()
				.setCustomId('getItem')
				.setPlaceholder('Choose an item.')
				.addOptions(itemOptions);

			const select2 = new StringSelectMenuBuilder()
				.setCustomId('category')
				.setPlaceholder('Choose an item category.')
				.addOptions(
					new StringSelectMenuOptionBuilder()
						.setLabel('Weapons')
						.setValue('weapons'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Armor')
						.setValue('armor'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Consumables')
						.setValue('consumables'),
					new StringSelectMenuOptionBuilder()
						.setLabel('Miscellaneous Items')
						.setValue('miscellaneous'),
				);

			const row1 = new ActionRowBuilder()
				.addComponents(select1);
			const row2 = new ActionRowBuilder()
				.addComponents(select2);

			const actionRow = [row1, row2, button];

			return await interaction.editReply({
				embeds: [embed],
				components: actionRow,
			});
		}
		catch (error) {
			console.log(error);
		}
	},
};
