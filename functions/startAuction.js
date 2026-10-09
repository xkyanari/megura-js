const { sequelize, Auction, AuctionItem } = require('../src/db');
const { auctionStatus } = require('./webhook');
const { SATS_PER_COIN } = require('./auctionMessage');

const MAX_HOURS = 30 * 24;

// Schedules the auction's end. Bull ignores a jobId it already has.
const scheduleAuctionEnd = (queue, auction) => queue.add(
	{ auctionId: auction.id, guildId: auction.guildID },
	{
		jobId: `auction-${auction.id}`,
		delay: Math.max(0, auction.endDateTime - Date.now()),
		attempts: 3,
		backoff: { type: 'exponential', delay: 5000 },
		removeOnComplete: true,
		removeOnFail: true,
	},
);

// endTime is in hours; startPrice in coins. Returns the auction, or null if it couldn't be created.
const startAuction = async (interaction, itemName, description = null, quantity = 1, startPrice, endTime, userId, attachment = null) => {
	let auction;
	let item;
	try {
		await sequelize.transaction(async (transaction) => {
			item = await AuctionItem.create({
				itemName,
				quantity: quantity || 1,
				description: description || 'No description provided',
			}, { transaction });

			const sats = Math.round(startPrice * SATS_PER_COIN);
			auction = await Auction.create({
				userID: userId,
				guildID: interaction.guild.id,
				itemId: item.id,
				startDateTime: new Date(),
				endDateTime: new Date(Date.now() + endTime * 60 * 60 * 1000),
				startPrice: sats,
				currentPrice: sats,
				winnerId: null,
				attachmentURL: attachment ?? undefined,
			}, { transaction });
		});
	}
	catch (err) {
		console.error('Failed to start auction:', err);
		return null;
	}

	// post it in the auction channel
	await auctionStatus(interaction.guild.id, interaction.member.id, item, auction);

	try {
		await scheduleAuctionEnd(interaction.client.auctionQueue, auction);
	}
	catch (error) {
		// the auction exists and is posted; the next bot start schedules its end
		console.error(`Could not schedule the end of auction ${auction.id}:`, error);
	}
	return auction;
};

module.exports = { startAuction, scheduleAuctionEnd, MAX_HOURS };
