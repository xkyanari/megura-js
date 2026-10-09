const { Op } = require('sequelize');
const { sequelize, Auction, AuctionClosure, Bid } = require('../src/db');

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
	await AuctionClosure.upsert({ auctionId: auction.id, closedAt: now }, { transaction });
	return auction;
});

// How far back startup looks for auctions that passed their end without being finalized
// (e.g. the bot was down, or scheduling failed). Older ones are left alone.
const RECOVERY_WINDOW = 7 * 24 * 60 * 60 * 1000;

// Auctions still to be finalized, e.g. to (re-)schedule them at startup: running ones,
// and recent overdue ones whose end never ran (those are scheduled to end right away).
const runningAuctions = async (now = Date.now()) => {
	const candidates = await Auction.findAll({ where: { endDateTime: { [Op.gt]: new Date(now - RECOVERY_WINDOW) } } });
	if (!candidates.length) return [];
	const closed = await AuctionClosure.findAll({ where: { auctionId: candidates.map((a) => a.id) } });
	const closedIds = new Set(closed.map((c) => c.auctionId));
	return candidates.filter((a) => !closedIds.has(a.id));
};

module.exports = { endAuction, runningAuctions };
