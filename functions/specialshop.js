const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const { footer, specialShopImage } = require('../src/vars');

module.exports = async (interaction) => {
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
				.setLabel('Event Items')
				.setValue('events'),
			new StringSelectMenuOptionBuilder()
				.setLabel('Digital Items')
				.setValue('digital'),
		);

	const row = new ActionRowBuilder()
		.addComponents(select);

	await interaction.reply({
		embeds: [embed],
		components: [row],
	});
};
