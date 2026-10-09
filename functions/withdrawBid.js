const { Auction, Bid, sequelize } = require('../src/db');

/**
 * Withdraws the member's bids on the auction behind this message, while it is
 * still open. Locks the auction, so it can't race a new bid or the auction ending.
 * Returns the auction with its new current price.
 */
const withdrawBid = (interaction) => sequelize.transaction(async (transaction) => {
	const auction = await Auction.findOne({
		where: { messageID: interaction.message.id, guildID: interaction.guild.id },
		transaction,
		lock: transaction.LOCK.UPDATE,
	});
	if (!auction) throw new Error('Auction not found');
	if (auction.endDateTime <= new Date()) throw new Error('The auction has already ended.');

	const removed = await Bid.destroy({
		where: { userId: `${interaction.member.id}-${interaction.guild.id}`, auctionId: auction.id },
		transaction,
	});
	if (!removed) throw new Error('No bid to withdraw');

	const highestBid = await Bid.findOne({
		where: { auctionId: auction.id },
		order: [['bidAmount', 'DESC']],
		transaction,
	});
	auction.currentPrice = highestBid ? highestBid.bidAmount : auction.startPrice;
	await auction.save({ transaction });
	return auction;
});

module.exports = { withdrawBid };
