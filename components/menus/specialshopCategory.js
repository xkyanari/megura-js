const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { Shop } = require('../../src/db');
const { footer } = require('../../src/vars');

const MAX_SHOWN = 25;

module.exports = {
	data: {
		name: 'specialshopCategory',
	},
	async execute(interaction) {
		const selected = await interaction.values[0];
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
		await interaction.deferUpdate();

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

		const itemList = await Shop.findAll({
			where: { category: selected, guildID: interaction.guild.id },
			order: [
				['level', 'ASC'],
			],
		});

		if (itemList.length === 0) return;

		// Discord allows 25 embed fields and 25 menu options
		const shown = itemList.slice(0, MAX_SHOWN);

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle(`${oreEmoji} **SPECIAL SHOP:** ${oreEmoji}`)
			.setFooter(footer);

		const itemOptions = [];
		shown.forEach((item) => {
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
			itemOptions.push({ label: item.itemName, value: item.itemName });

			embed.addFields({
				name: `__**${item.itemName}**__`,
				value: itemStats.join(''),
				inline: false,
			});
		});

		if (itemList.length > shown.length) {
			embed.setDescription(`Showing the first ${shown.length} of ${itemList.length} items in this category.`);
		}

		const select1 = new StringSelectMenuBuilder()
			.setCustomId('getItem')
			.setPlaceholder('Choose an item.')
			.addOptions(itemOptions);

		const row1 = new ActionRowBuilder()
			.addComponents(select1);

		return await interaction.followUp({
			embeds: [embed],
			components: [row1],
			flags: 64,
		});
	},
};
