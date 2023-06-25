const { sequelize, Auction, AuctionItem } = require('../src/db');
const { auctionStatus } = require('./webhook');

const startAuction = async (interaction, itemName, description = null, quantity = 1, startPrice, endTime, userId, attachment = null) => {
    let transaction;

    try {
        transaction = await sequelize.transaction();

        const item = await AuctionItem.create({
            itemName,
            quantity: quantity || 1,
            description: description || 'No description provided',
        }, { transaction });

        const auctionData = {
            userID: userId,
            guildID: interaction.guild.id,
            itemId: item.id,
            startDateTime: new Date(),
            endDateTime: new Date(Date.now() + endTime * 60 * 60 * 1000), // endTime is assumed to be in hours
            startPrice: startPrice * 100000000, // converted to satoshis
            currentPrice: startPrice * 100000000, // converted to satoshis
            winnerId: null,
        };

        if (attachment) {
            auctionData.attachmentURL = attachment;
        }

        const auction = await Auction.create(auctionData, { transaction });

        await transaction.commit();
        transaction = null;

        // post a webhook on the channel
        await auctionStatus(interaction.guild.id, interaction.member.id, item, auction);

        // start a timer to end the auction after the specified duration
        await interaction.client.auctionQueue.add({
            auctionId: auction.id,
            guildId: interaction.guild.id,
        }, {
            delay: endTime * 60 * 60 * 1000,  // delay job for endTime hours
            attempts: 3,  // retry up to 3 times
            backoff: {
                type: 'exponential',
                delay: 5000  // wait 5 seconds between retries
            }
        });

        return auction;
    } catch (err) {
        if (transaction) await transaction.rollback();

        console.error('Failed to start auction:', err);
        return null;
    }
};

module.exports = { startAuction };