const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, userMention } = require('discord.js');
const { Brawl } = require('../../src/db');
const { generateId } = require('../../functions/generateId');

module.exports = {
	data: {
		name: 'brawl-register',
	},
	async execute(interaction) {
		const wager = interaction.fields.getTextInputValue('wager');
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
		const challengerId = interaction.member.id;

		// add check if player has enough ORE to add as wager
		// if (wager === 1) return await interaction.reply({ content: `Please enter a valid wager. Minimum is 1 ${oreEmoji}`, ephemeral: true });

		try {
			const listingId = await generateId(5);
			const embed = new EmbedBuilder()
				.setTitle('New Brawl Challenge Listed')
				.setColor(0xcd7f32)
				.setDescription(`**Challenger:** ${userMention(challengerId)}\nWager: ${wager} ${oreEmoji}\nStatus: Pending`)
				.setFooter({ text: `Listing ID: ${listingId}` });

			const button = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('brawl-accept')
					.setLabel('Accept')
					.setStyle(ButtonStyle.Primary),
			);

			await interaction.reply({
				content: 'A new challenge has been created!',
				embeds: [embed],
				components: [button],
			});

			await Brawl.create({
				listingId,
				challengerId,
				wager,
				status: 'pending',
			});
		}
		catch (error) {
			console.error(error);
		}
	},
};
