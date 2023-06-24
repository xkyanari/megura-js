const { Auction, Bid, sequelize } = require('../src/db');
const { getUtxos } = require('./getUtxos');

const placeBid = async (interaction, user) => {
    let transaction;

    try {
        // start a new transaction
        transaction = await sequelize.transaction();

        // fetch the auction
        const auction = await Auction.findOne({
            where: { messageID: interaction.message.id },
            transaction,
        });

        // check if the auction is still ongoing
        if (auction.endDateTime > new Date()) {
            // find the highest bid
            const highestBid = await Bid.findOne({
                where: { auctionId: auction.id },
                order: [['bidAmount', 'DESC']],
                transaction,
            });

            // calculate the bid amount
            const bidAmount = highestBid
                ? highestBid.bidAmount + (highestBid.bidAmount * 0.05)
                : auction.startPrice + (auction.startPrice * 0.05);

            // add utxo check from here
            const utxos = await getUtxos(user.walletAddress, user.publicKey, bidAmount.toFixed(2));

            if (utxos) {
                // place the new bid
                const newBid = await Bid.create({
                    auctionId: auction.id,
                    userId: interaction.user.id,
                    bidAmount: bidAmount.toFixed(2),
                    bidDateTime: new Date(),
                }, { transaction });

                // update the current price in the auction
                auction.currentPrice = bidAmount.toFixed(2);
                await auction.save({ transaction });

                // commit the transaction
                await transaction.commit();

                return newBid;
            }
        } else {
            throw new Error('The auction has already ended.');
        }
    } catch (err) {
        // if something goes wrong, rollback the transaction
        if (transaction) await transaction.rollback();

        throw err;  // Throw the error instead of logging it
    }
};

module.exports = { placeBid };
