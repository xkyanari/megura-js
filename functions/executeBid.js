const { placeBid } = require('./placeBid');
const { refreshOpenAuction, coins } = require('./auctionMessage');
const { User, Auction } = require('../src/db');

const REFUSALS = {
	'Auction not found': 'This auction no longer exists.',
	'Insufficient funds': 'You do not have enough funds to place this bid.',
	'The auction has already ended.': 'The auction has already ended.',
	'The price changed.': 'Someone else bid at the same time. Please try again.',
};

const executeBid = async (interaction, bidAmount) => {
	await interaction.deferReply({ flags: 64 });
	const userGuildId = `${interaction.member.id}-${interaction.guild.id}`;
	const user = await User.findOne({ where: { userGuildId } });

	if (!user || !user.walletAddress) return interaction.editReply({ content: 'Please register your wallet first.' });

	let bid;
	try {
		bid = await placeBid(interaction, user, bidAmount);
	}
	catch (error) {
		if (REFUSALS[error.message]) return interaction.editReply({ content: REFUSALS[error.message] });
		throw error;
	}

	await refreshOpenAuction(await Auction.findByPk(bid.auctionId));
	return interaction.editReply({ content: `Placed bid for ${coins(bid.bidAmount)} 🪙.` });
};

module.exports = { executeBid };
