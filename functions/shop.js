const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
// const { Shop } = require('../src/db');
const { footer, shopImage } = require('../src/vars');
// const buttonPages = require('./paginator');

// function chunkArray(array, chunkSize) {
// 	const results = [];
// 	while (array.length) {
// 		results.push(array.splice(0, chunkSize));
// 	}

// 	return results;
// }

module.exports = async (interaction) => {
	try {
		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('🛒 **ITEM SHOP:** 🛒')
			.setDescription('Type `/buy <item ID> <amount>` to buy.')
			.setImage(shopImage)
			.setFooter(footer);

		const select = new StringSelectMenuBuilder()
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

		const row = new ActionRowBuilder()
			.addComponents(select);

		const button1 = new ActionRowBuilder().addComponents(
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
			new ButtonBuilder()
				.setCustomId('shop')
				.setEmoji('🛒')
				.setLabel('Shop')
				.setStyle(ButtonStyle.Danger),
		);

		await interaction.reply({
			embeds: [embed],
			components: [row, button1],
		});

		// const shop = await Shop.findAll();

		// const shopChunks = chunkArray(shop, 5);
		// const itemOptions = [];
		// const embeds = [];

		// shopChunks.forEach((chunk, chunkIndex) => {
		// 	const embed = new EmbedBuilder()
		// 		.setColor(0xCD7F32)
		// 		.setTitle(`🛒 **ITEM SHOP (Page ${chunkIndex + 1}):** 🛒`)
		// 		.setDescription('Type `/buy <item ID> <amount>` to buy in bulk.')
		// 		.setFooter(footer);

		// 	chunk.forEach(item => {
		// 		const itemStats = [];

		// 		if (item.totalHealth > 0) {
		// 			itemStats.push(`Total Health: ${item.totalHealth}\n`);
		// 		}
		// 		if (item.totalAttack > 0) {
		// 			itemStats.push(`Total Attack: ${item.totalAttack}\n`);
		// 		}
		// 		if (item.totalDefense > 0) {
		// 			itemStats.push(`Total Defense: ${item.totalDefense}\n`);
		// 		}
		// 		itemStats.push(`Price: $${numFormat(item.price)} IURA\n`);
		// 		itemStats.push(`Description: ${item.description}\n`);
		// 		itemStats.push(`Item ID: \`${item.item_ID}\``);
		// 		itemOptions.push({ 'label': item.itemName, 'value': item.itemName });

		// 		embed.addFields({ name: `__**${item.itemName}**__`, value: itemStats.join(''), inline: false });
		// 	});

		// 	embeds.push(embed);
		// });

		// buttonPages(interaction, embeds);

	}
	catch (error) {
		console.error(error);
	}
};
