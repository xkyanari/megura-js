const { default: axios } = require('axios');
const { Auction, Bid, sequelize } = require('../src/db');
// const { getUtxos } = require('./getUtxos');

const checkBalance = async (address, amount) => {
	const apiURL = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`;

	let response;
	try {
		response = await axios.get(apiURL, { timeout: 10000 });
	}
	catch (error) {
		console.error('Error fetching balance from BlockCypher API:', error);
		return false;
	}

	if (response.data && response.data.balance) {
		const balance = response.data.balance;

		if (amount <= balance) {
			return true;
		}
		else {
			console.log(`Insufficient funds: Required ${amount}, but balance is ${balance}`);
			return false;
		}
	}
	else {
		console.error('Unexpected response data from BlockCypher API:', response.data);
		return false;
	}
};

// The next bid on `auction`: the highest bid (or the start price) plus `amount`.
const nextBidAmount = async (auction, amount, transaction) => {
	const highestBid = await Bid.findOne({
		where: { auctionId: auction.id },
		order: [['bidAmount', 'DESC']],
		transaction,
	});
	return Number(highestBid ? highestBid.bidAmount : auction.startPrice) + amount;
};

const isOpen = (auction) => auction.endDateTime > new Date();

const placeBid = async (interaction, user, amount) => {
	// check the wallet first, outside the lock: the balance lookup can take seconds
	const preview = await Auction.findOne({ where: { messageID: interaction.message.id, guildID: interaction.guild.id } });
	if (!preview) throw new Error('Auction not found');
	if (!isOpen(preview)) throw new Error('The auction has already ended.');

	const expected = await nextBidAmount(preview, amount);
	if (!await module.exports.checkBalance(user.walletAddress, expected)) throw new Error('Insufficient funds');

	return sequelize.transaction(async (transaction) => {
		// lock the auction so concurrent bids (and ending it) are applied one at a time
		const auction = await Auction.findByPk(preview.id, { transaction, lock: transaction.LOCK.UPDATE });
		if (!isOpen(auction)) throw new Error('The auction has already ended.');

		const bidAmount = await nextBidAmount(auction, amount, transaction);
		// someone outbid us while the balance was checked: the checked amount no longer applies
		if (bidAmount !== expected) throw new Error('The price changed.');

		console.log(`Auction ID: ${auction.id}, User ID: ${interaction.user.id}, Bid Amount: ${bidAmount}`);
		const newBid = await Bid.create({
			auctionId: auction.id,
			userId: `${interaction.member.id}-${interaction.guild.id}`,
			bidAmount,
			bidDateTime: new Date(),
		}, { transaction });

		auction.currentPrice = bidAmount;
		auction.version += 1;
		await auction.save({ transaction });
		return newBid;
	});
};

module.exports = { placeBid, checkBalance };
