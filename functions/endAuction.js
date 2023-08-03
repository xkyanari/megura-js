const { sequelize, Auction, Bid } = require('../src/db');

const endAuction = async (auctionId) => {
	let transaction;

	try {
		transaction = await sequelize.transaction();

		const auction = await Auction.findOne({
			where: { id: auctionId },
			transaction,
		});

		if (!auction) {
			throw new Error(`Auction ID ${auctionId} not found`);
		}

		// find the highest bid
		const highestBid = await Bid.findOne({
			where: { auctionId: auction.id },
			order: [['bidAmount', 'DESC']],
			transaction,
		});

		// if there's a highest bid, assign the winner
		if (highestBid) {
			auction.winnerId = highestBid.userId;
			auction.currentPrice = highestBid.bidAmount;
		}

		// set the end time to now
		auction.endDateTime = new Date();

		// save the auction
		await auction.save({ transaction });

		// commit the transaction
		await transaction.commit();

		return {
			success: true,
		};

	}
	catch (err) {
		// if something goes wrong, rollback the transaction
		if (transaction) await transaction.rollback();

		console.error('Failed to end auction:', err);

		return {
			success: false,
		};
	}
};

module.exports = { endAuction };
