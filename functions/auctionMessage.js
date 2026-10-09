const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, WebhookClient, userMention } = require('discord.js');
const { Guild, Bid } = require('../src/db');
const { dahliaAvatar, dahliaName } = require('../src/vars');

/**
 * The auction post in the server's auction channel (sent through its webhook),
 * built in one place for open, after-bid and closed states.
 */

const SATS_PER_COIN = 100000000;
const coins = (sats) => Number(sats) / SATS_PER_COIN;

const auctionEmbed = (auction, item, { closed = false } = {}) => {
	const fields = [
		{ name: 'Quantity:', value: `${item.quantity}`, inline: true },
		{ name: 'Starting Price:', value: `${coins(auction.startPrice)}🪙`, inline: true },
		{ name: 'Highest Bid:', value: `${coins(auction.currentPrice)}🪙`, inline: true },
	];
	if (!closed) {
		fields.push(
			{ name: 'Start:', value: `<t:${Math.floor(auction.startDateTime.getTime() / 1000)}:f>`, inline: true },
			{ name: 'End:', value: `<t:${Math.floor(auction.endDateTime.getTime() / 1000)}:f>`, inline: true },
		);
	}
	fields.push({ name: 'Auctioneer:', value: userMention(auction.userID), inline: !closed });
	if (closed && auction.winnerId) {
		fields.push({ name: 'Winner:', value: userMention(auction.winnerId.split('-')[0]), inline: true });
	}

	const embed = new EmbedBuilder()
		.setTitle(closed ? `Auction: ${item.itemName}` : `${item.itemName}`)
		.setColor(0xcd7f32)
		.addFields(fields)
		.setFooter({ text: `Auction ID: ${auction.id}` });
	if (auction.attachmentURL) embed.setImage(auction.attachmentURL);
	if (item.description && item.description !== 'No description provided') embed.setDescription(item.description);
	return embed;
};

const openButtons = (withWithdraw) => {
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('registerAuction').setLabel('Register').setStyle(ButtonStyle.Success),
		new ButtonBuilder().setCustomId('placeBid1').setLabel('Bid [+0.0033🪙]').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('placeBid2').setLabel('Bid [+0.01🪙]').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId('placeBid3').setLabel('Bid [+0.02🪙]').setStyle(ButtonStyle.Primary),
	);
	if (withWithdraw) {
		row.addComponents(new ButtonBuilder().setCustomId('withdrawBid').setLabel('Withdraw').setStyle(ButtonStyle.Danger));
	}
	return row;
};

const openPayload = (auction, item, withWithdraw) => ({
	content: '**The Auction is now OPEN!**',
	username: dahliaName,
	avatarURL: dahliaAvatar,
	embeds: [auctionEmbed(auction, item)],
	components: [openButtons(withWithdraw)],
});

const closedPayload = (auction, item) => ({
	content: '**The Auction is now CLOSED!**',
	username: dahliaName,
	avatarURL: dahliaAvatar,
	embeds: [auctionEmbed(auction, item, { closed: true })],
	components: [],
});

const webhookFor = async (guildID) => {
	const guild = await Guild.findOne({ where: { guildID } });
	if (!guild?.auctionwebhookId || !guild?.auctionwebhookToken) return null;
	return new WebhookClient({ id: guild.auctionwebhookId, token: guild.auctionwebhookToken });
};

// Edits the auction's post. Returns false if the server has no auction channel or the post is unknown.
const editAuctionMessage = async (auction, payload) => {
	if (!auction.messageID) return false;
	const webhook = await module.exports.webhookFor(auction.guildID);
	if (!webhook) return false;
	await webhook.editMessage(auction.messageID, payload);
	return true;
};

// Shows the latest price on an open auction (with Withdraw while there are bids).
const refreshOpenAuction = async (auction) => {
	const item = await auction.getAuctionItem();
	const hasBids = await Bid.count({ where: { auctionId: auction.id } }) > 0;
	return editAuctionMessage(auction, openPayload(auction, item, hasBids));
};

const announceAuctionEnd = async (auction) => {
	const item = await auction.getAuctionItem();
	return editAuctionMessage(auction, closedPayload(auction, item));
};

module.exports = {
	SATS_PER_COIN,
	coins,
	auctionEmbed,
	openPayload,
	closedPayload,
	webhookFor,
	editAuctionMessage,
	refreshOpenAuction,
	announceAuctionEnd,
};
