const { EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Shop } = require('../../src/db');
const { footer } = require('../../src/vars');

module.exports = {
	data: {
		name: 'category',
	},
	async execute(interaction) {
		const selected = await interaction.values[0];
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
		await interaction.deferUpdate();

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

		try {
			const itemList = await Shop.findAll({
				where: { category: selected },
			});

			const hasGuildItem = itemList.some(item => item.guildID !== null);

			if (itemList.length === 0) return;

			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle(`${hasGuildItem ? '💎 **SPECIAL SHOP:** 💎' : '🛒 **ITEM SHOP:** 🛒'}`)
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
				if (!item.guildID) {
					itemStats.push(`Level: ${item.level}\n`);
					itemStats.push(`Price: $${numFormat(item.price)} IURA\n`);
					itemStats.push(`Item ID: \`${item.item_ID}\``);
				}
				if (item.guildID) {
					itemStats.push(`Price: ${numFormat(item.price)} ${oreEmoji}\n`);
					itemStats.push(`Quantity: ${item.quantity > 0 ? item.quantity : '**SOLD OUT**'}\n`);
				}
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

			const select3 = new StringSelectMenuBuilder()
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

			const row1 = new ActionRowBuilder()
				.addComponents(select1);
			const row2 = new ActionRowBuilder()
				.addComponents(select2);
			const row3 = new ActionRowBuilder()
				.addComponents(select3);

			const actionRow = hasGuildItem ? [row1, row3, button] : [row1, row2, button];

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
