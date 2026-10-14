const { Player, Shop } = require('../src/db');
const { gameEmbed } = require('./embedStyle');
const buttonPages = require('./paginator');

module.exports = async (interaction) => {
	const member = interaction.member;
	const guild = interaction.guild;
	const itemsPerPage = 3; // Number of items to display per page

	const player = await Player.findOne({
		where: { discordID: member.id, guildID: guild.id },
		include: 'item',
	});

	if (!player) {
		throw new Error('profile not found');
	}

	const items = await player.getItems();

	items.sort((a, b) => b.equipped - a.equipped);

	await interaction.deferReply();

	const embeds = [];
	let currentEmbed = gameEmbed('inventory')
		.setAuthor({ name: `${interaction.user.tag}` })
		.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
		.setTitle('🛄 Voyager Inventory')
		.setDescription('Your gear and supplies. Use `/equip` or `/unequip` to change your loadout.');

	if (items.length === 0) {
		currentEmbed.addFields({
			name: 'Your pack is empty',
			value: 'Fight monsters with `/attack` or visit `/shop` to find your first items.',
			inline: false,
		});
	}

	for (let i = 0; i < items.length; i++) {
		if (i !== 0 && i % itemsPerPage === 0) {
			embeds.push(currentEmbed);
			currentEmbed = gameEmbed('inventory')
				.setAuthor({ name: `${interaction.user.tag}` })
				.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
				.setTitle('🛄 Voyager Inventory')
				.setDescription('Your gear and supplies. Use `/equip` or `/unequip` to change your loadout.');
		}

		const item = items[i];
		const shopItem = await Shop.findOne({ where: { itemName: item.itemName } });
		if (!shopItem) {
			continue; // Skip this iteration of the loop
		}
		const { item_ID, guildID } = shopItem;

		let fieldValue;
		if (guildID) {
			fieldValue = `**${item.quantity + item.equippedAmount}** owned`;
		}
		else {
			fieldValue = `**${item.quantity}** in pack · **${item.equippedAmount}** equipped\nItem ID: \`${item_ID}\``;
		}

		currentEmbed.addFields({
			name: item.upgradeLevel > 0 ? `${item.itemName} +${item.upgradeLevel}` : item.itemName,
			value: fieldValue,
			inline: false,
		});
	}

	embeds.push(currentEmbed);

	await buttonPages(interaction, embeds, null, null, 60000);
};
