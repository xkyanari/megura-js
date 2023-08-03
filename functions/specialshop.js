const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const { footer, specialShopImage } = require('../src/vars');

module.exports = async (interaction) => {
	try {
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle(`${oreEmoji} **SPECIAL SHOP:** ${oreEmoji}`)
			.setDescription('Special items sold here!')
			.setImage(specialShopImage)
			.setFooter(footer);

		const select = new StringSelectMenuBuilder()
			.setCustomId('specialshopCategory')
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

		await interaction.reply({
			embeds: [embed],
			components: [row],
		});

	}
	catch (error) {
		console.error(error);
	}
};
