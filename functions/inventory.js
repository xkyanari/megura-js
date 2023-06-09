const { EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');
const { footer, checkProfile } = require('../src/vars');
const buttonPages = require('./paginator');

module.exports = async (interaction) => {
	const member = interaction.member;
	const guild = interaction.guild;
	const itemsPerPage = 10; // Number of items to display per page

	const player = await Player.findOne({
		where: { discordID: member.id, guildID: guild.id },
		include: 'item',
	});
	const items = await player.getItems();

	if (!player) {
		return interaction.editReply(checkProfile);
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
					.setFooter(footer);
			}

			const item = items[i];
			currentEmbed.addFields({
				name: item.itemName,
				value: `Quantity: ${item.quantity}\nEquipped: ${item.equipped ? 'Yes' : 'No'}`,
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
