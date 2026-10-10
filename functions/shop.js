const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } = require('discord.js');
const { shopImage } = require('../src/vars');

const { gameEmbed } = require('./embedStyle');

module.exports = async (interaction) => {
	const embed = gameEmbed()
		.setTitle('🛒 Item Shop')
		.setDescription('Choose a category below to browse gear and supplies.\nUse `/buy` with an item ID and amount to purchase.')
		.setImage(shopImage);

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
			new StringSelectMenuOptionBuilder()
				.setLabel('Materials')
				.setValue('materials'),
		);

	const row = new ActionRowBuilder()
		.addComponents(select);

	await interaction.reply({
		embeds: [embed],
		components: [row],
	});
};
