const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { footer, specialShopImage } = require('../src/vars');

module.exports = async (interaction) => {
	try {
		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('💎 **SPECIAL SHOP:** 💎')
			.setDescription('Special items sold here!')
			.setImage(specialShopImage)
			.setFooter(footer);

		const select = new StringSelectMenuBuilder()
			.setCustomId('category')
			.setPlaceholder('Choose an item category.')
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel('Whitelist')
					.setValue('whitelist'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Event Items')
					.setValue('events'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Digital Items')
					.setValue('digital'),
				new StringSelectMenuOptionBuilder()
					.setLabel('NFTs')
					.setValue('nfts'),
					new StringSelectMenuOptionBuilder()
					.setLabel('Cryptocurrencies')
					.setValue('crypto'),
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
