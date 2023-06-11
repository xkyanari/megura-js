const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { footer, shopImage } = require('../src/vars');

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

	}
	catch (error) {
		console.error(error);
	}
};
