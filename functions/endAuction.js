const { Op } = require('sequelize');
const { sequelize, Auction, Bid } = require('../src/db');

/**
 * Ends an auction: the highest bid wins, and the end time is brought forward
 * to now if it hasn't passed yet. Locks the auction, so it can't race a bid
 * being placed or withdrawn. Safe to run more than once (a retry, or the timer
 * after /auction end): the result is the same.
 *
 * Pass `guildID` to only end an auction of that server.
 * Returns the ended auction, or null if there is no such auction.
 */
const endAuction = (auctionId, guildID) => sequelize.transaction(async (transaction) => {
	const where = { id: auctionId };
	if (guildID) where.guildID = guildID;
	const auction = await Auction.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
	if (!auction) return null;

	const highestBid = await Bid.findOne({
		where: { auctionId: auction.id },
		order: [['bidAmount', 'DESC'], ['bidDateTime', 'ASC']],
		transaction,
	});
	auction.winnerId = highestBid?.userId ?? null;
	auction.currentPrice = highestBid ? highestBid.bidAmount : auction.startPrice;

	const now = new Date();
	if (auction.endDateTime > now) auction.endDateTime = now;

	await auction.save({ transaction });
	return auction;
});

// Auctions whose end hasn't been reached yet, e.g. to re-schedule them at startup.
const runningAuctions = () => Auction.findAll({ where: { endDateTime: { [Op.gt]: new Date() } } });

module.exports = { endAuction, runningAuctions };
