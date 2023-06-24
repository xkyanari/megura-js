const { Auction, Bid } = require('../src/db');

const withdrawBid = async (interaction) => {
    try {
        const auction = await Auction.findOne({ where: { messageID: interaction.message.id } });

        await Bid.destroy({ where: { userID: interaction.user.id, auctionID: auction.id } });

        const highestBid = await Bid.findOne({ where: { auctionID: auction.id }, order: [['bidAmount', 'DESC']] });

        auction.currentPrice = highestBid ? highestBid.bidAmount : auction.startPrice;
        await auction.save();

        return auction;
    } catch (err) {
        console.error('Failed to withdraw bid:', err);
        return null;
    }
};

module.exports = { withdrawBid };
