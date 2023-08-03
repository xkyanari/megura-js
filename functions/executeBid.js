const { WebhookClient, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, userMention } = require('discord.js');
const { OptimisticLockError } = require('sequelize');
const { placeBid } = require('./placeBid');
const { User, Auction, Guild } = require('../src/db');
const { dahliaAvatar, dahliaName } = require('../src/vars');

const executeBid = async (interaction, bidAmount) => {
	try {
		await interaction.deferReply({ ephemeral: true });
		const userGuildId = `${interaction.member.id}-${interaction.guild.id}`;
		const user = await User.findOne({ where: { userGuildId } });

		if (!user || !user.walletAddress) return await interaction.editReply({ content: 'Please register your wallet first.', ephemeral: true });

		const bid = await placeBid(interaction, user, bidAmount);

		const auction = await Auction.findByPk(bid.auctionId);
		const item = await auction.getAuctionItem();
		const { auctionwebhookId, auctionwebhookToken } = await Guild.findOne({ where: { guildId: interaction.guild.id } });
		const webhookClient = new WebhookClient({ id: auctionwebhookId, token: auctionwebhookToken });

		const startDateTimeUnix = Math.floor(auction.startDateTime.getTime() / 1000);
		const endDateTimeUnix = Math.floor(auction.endDateTime.getTime() / 1000);
		const newEmbed = new EmbedBuilder()
			.setTitle(`${item.itemName}`)
			.setColor(0xcd7f32)
			.addFields(
				{ name: 'Quantity:', value: `${item.quantity}`, inline: true },
				{ name: 'Starting Price:', value: `${auction.startPrice / 100000000}🪙`, inline: true },
				{ name: 'Highest Bid:', value: `${auction.currentPrice / 100000000}🪙`, inline: true },
				{ name: 'Start:', value: `<t:${startDateTimeUnix}:f>`, inline: true },
				{ name: 'End:', value: `<t:${endDateTimeUnix}:f>`, inline: true },
				{ name: 'Auctioneer:', value: `${userMention(auction.userID)}`, inline: false },
			)
			.setFooter({ text: `Auction ID: ${auction.id}` });

		if (auction.attachmentURL) {
			newEmbed.setImage(auction.attachmentURL);
		}

		if (item.description !== 'No description provided') {
			newEmbed.setDescription(item.description);
		}

		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('registerAuction')
				.setLabel('Register')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId('placeBid1')
				.setLabel('Bid [+0.0033🪙]')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('placeBid2')
				.setLabel('Bid [+0.01🪙]')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('placeBid3')
				.setLabel('Bid [+0.02🪙]')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('withdrawBid')
				.setLabel('Withdraw')
				.setStyle(ButtonStyle.Danger),
		);

		const message = await webhookClient.editMessage(auction.messageID, {
			content: '**The Auction is now OPEN!**',
			username: dahliaName,
			avatarURL: dahliaAvatar,
			embeds: [newEmbed],
			components: [button],
		});

		if (message) {
			return await interaction.editReply({
				content: `Placed bid for ${bid.bidAmount / 100000000} 🪙.`,
				ephemeral: true,
			});
		}

	}
	catch (error) {
		if (error instanceof OptimisticLockError) {
			return await interaction.editReply({
				content: 'Your bid was unsuccessful because you were outbid. Please try again.',
				ephemeral: true,
			});
		}

		if (error.message === 'Insufficient funds') {
			return await interaction.editReply({ content: 'You do not have enough funds to place this bid.', ephemeral: true });
		}
		if (error.message === 'The auction has already ended.') {
			return await interaction.editReply({ content: 'The auction has already ended.', ephemeral: true });
		}
		else {
			console.error(error);
			return await interaction.editReply({ content: 'Failed to place a bid due to an error.', ephemeral: true });
		}
	}
};

module.exports = { executeBid };