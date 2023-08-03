const { default: axios } = require('axios');
const { Auction, Bid, sequelize } = require('../src/db');
// const { getUtxos } = require('./getUtxos');

const checkBalance = async (address, amount) => {
	const apiURL = `https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance`;

	let response;
	try {
		response = await axios.get(apiURL);
	}
	catch (error) {
		console.error('Error fetching balance from BlockCypher API:', error);
		return false;
	}

	if (response.data && response.data.balance) {
		const balance = response.data.balance;

		if (amount < balance) {
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

const placeBid = async (interaction, user, amount) => {
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
				? highestBid.bidAmount + amount
				: auction.startPrice + amount;

			// add utxo check from here
			// const utxos = await getUtxos(user.walletAddress, user.publicKey, bidAmount.toFixed(2));

			const balance = await checkBalance(user.walletAddress, bidAmount);
			// const balance = true;

			if (balance) {
				console.log(`Auction ID: ${auction.id}, User ID: ${interaction.user.id}, Bid Amount: ${bidAmount}`);

				// place the new bid
				const newBid = await Bid.create({
					auctionId: auction.id,
					userId: `${interaction.member.id}-${interaction.guild.id}`,
					bidAmount: bidAmount,
					bidDateTime: new Date(),
				}, { transaction });

				// update the current price in the auction
				auction.currentPrice = bidAmount;

				// increment the version
				auction.version += 1;

				await auction.save({ transaction });

				// commit the transaction
				await transaction.commit();

				return newBid;
			}
			else {
				throw new Error('Insufficient funds');
			}
		}
		else {
			throw new Error('The auction has already ended.');
		}
	}
	catch (err) {
		// if something goes wrong, rollback the transaction
		if (transaction) await transaction.rollback();

		throw err; // Throw the error instead of logging it
	}
};

module.exports = { placeBid };
