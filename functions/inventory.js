const { EmbedBuilder } = require('discord.js');
const { Player, Shop } = require('../src/db');
const { footer } = require('../src/vars');
const buttonPages = require('./paginator');

module.exports = async (interaction) => {
	const member = interaction.member;
	const guild = interaction.guild;
	const itemsPerPage = 3; // Number of items to display per page

	const player = await Player.findOne({
		where: { discordID: member.id, guildID: guild.id },
		include: 'item',
	});
	const items = await player.getItems();

	if (!player) {
		throw new Error('profile not found');
	}

	items.sort((a, b) => b.equipped - a.equipped);

	try {
		await interaction.deferReply();

		const embeds = [];
		let currentEmbed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setAuthor({ name: `${interaction.user.tag}` })
			.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
			.setTitle('**🛄 INVENTORY LIST**')
			.setDescription('Type `/equip` or `/unequip` to apply them to your stats.')
			.setFooter(footer);

		if (items.length === 0) {
			currentEmbed.addFields({
				name: '\u200b',
				value: 'Nothing here!',
				inline: false,
			});
		}

		for (let i = 0; i < items.length; i++) {
			if (i !== 0 && i % itemsPerPage === 0) {
				embeds.push(currentEmbed);
				currentEmbed = new EmbedBuilder()
					.setColor(0xcd7f32)
					.setAuthor({ name: `${interaction.user.tag}` })
					.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
					.setTitle('**🛄 INVENTORY LIST**')
					.setDescription('Type `/equip` or `/unequip` to apply them to your stats.')
					.setFooter(footer);
			}

			const item = items[i];
			const shopItem = await Shop.findOne({ where: { itemName: item.itemName } });
			if (!shopItem) {
				console.log(`Item not found in Shop for itemName: ${item.itemName}`);
				continue;  // Skip this iteration of the loop
			}
			const { item_ID } = shopItem;
			currentEmbed.addFields({
				name: item.itemName,
				value: `Unequipped: ${item.quantity}\nEquipped: ${item.equippedAmount}\n__Total Amount:__ **${item.quantity + item.equippedAmount}**\nItem ID: \`${item_ID}\``,
				inline: false,
			});
		}

		embeds.push(currentEmbed);

		await buttonPages(interaction, embeds, null, null, 60000);
	}
	catch (error) {
		console.log(error);
	}
};
