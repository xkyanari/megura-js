const { Auction, Bid, sequelize } = require('../src/db');

const withdrawBid = async (interaction) => {
	return sequelize.transaction(async (t) => {
		try {
			const auction = await Auction.findOne({
				where: { messageID: interaction.message.id },
				transaction: t,
			});

			await Bid.destroy({
				where: { userID: `${interaction.member.id}-${interaction.guild.id}`, auctionID: auction.id },
				transaction: t,
			});

			const highestBid = await Bid.findOne({
				where: { auctionID: auction.id },
				order: [['bidAmount', 'DESC']],
				transaction: t,
			});

			auction.currentPrice = highestBid ? highestBid.bidAmount : auction.startPrice;
			await auction.save({ transaction: t });

			auction.currentPrice = auction.currentPrice / 100000000;
			return auction;
		}
		catch (err) {
			console.error('Failed to withdraw bid:', err);
			throw err; // If there is an error, rollback the transaction
		}
	});
};

module.exports = { withdrawBid };
