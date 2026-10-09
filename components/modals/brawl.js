const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, userMention } = require('discord.js');
const { Player } = require('../../src/db');
const { generateId } = require('../../functions/generateId');
const { openBrawl, expireBrawl, BRAWL_EXPIRY } = require('../../functions/brawlWager');

module.exports = {
	data: {
		name: 'brawl-register',
	},
	async execute(interaction) {
		const input = interaction.fields.getTextInputValue('wager').trim();
		const wager = Number(input);
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
		const challengerId = interaction.member.id;
		const guildID = interaction.guild.id;

		if (!/^\d+$/.test(input) || !Number.isSafeInteger(wager) || wager < 1) {
			return await interaction.reply({ content: `Please enter a valid wager. Minimum is 1 ${oreEmoji}`, flags: 64 });
		}

		const challenger = await Player.findOne({
			where: { discordID: challengerId, guildID },
		});

		if (!challenger) {
			throw new Error('profile not found');
		}

		const listingId = await generateId(5);

		const embed = new EmbedBuilder()
			.setTitle('⚔️ Brawl Challenge Open ⚔️')
			.setColor(0xcd7f32)
			.setDescription(`**Challenger:** ${userMention(challengerId)}\nWager: ${wager} ${oreEmoji}\nStatus: Pending`)
			.setTimestamp()
			.setThumbnail(`${interaction.member.displayAvatarURL({ extension: 'png', size: 512 })}`)
			.setFooter({ text: `Listing ID: ${listingId}` });

		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('brawl-accept')
				.setEmoji('✋')
				.setLabel('Accept')
				.setStyle(ButtonStyle.Primary),
		);

		try {
			await openBrawl({ listingId, challengerId, guildID, wager });
		}
		catch (error) {
			if (error.message === 'insufficient funds') {
				return await interaction.reply({ content: `You do not have enough ${oreEmoji} to wager.`, flags: 64 });
			}
			throw error;
		}

		let message;
		try {
			await interaction.reply({
				content: 'A new challenge has been created!',
				embeds: [embed],
				components: [button],
			});
			message = await interaction.fetchReply();
		}
		catch (error) {
			// nobody can see the listing, so give the stake back right away
			await expireBrawl(listingId, guildID);
			throw error;
		}

		// Expires the listing and refunds the challenger if nobody accepts.
		// Queued in Redis so it still runs after a restart.
		try {
			await interaction.client.brawlQueue.add(
				{ type: 'expire', listingId, guildID, channelId: message.channelId, messageId: message.id },
				{ delay: BRAWL_EXPIRY, removeOnComplete: true },
			);
		}
		catch (error) {
			console.error('Could not queue brawl expiry, falling back to a timer:', error);
			setTimeout(() => expireBrawl(listingId, guildID).catch(console.error), BRAWL_EXPIRY);
		}
	},
};
