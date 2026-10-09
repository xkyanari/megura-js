const { withdrawBid } = require('../../functions/withdrawBid');
const { refreshOpenAuction } = require('../../functions/auctionMessage');
const { User } = require('../../src/db');

const REFUSALS = {
	'Auction not found': 'This auction no longer exists.',
	'The auction has already ended.': 'The auction has already ended, so bids can no longer be withdrawn.',
	'No bid to withdraw': 'You have no bid on this auction.',
};

module.exports = {
	data: {
		name: 'withdrawBid',
	},
	async execute(interaction) {
		await interaction.deferReply({ flags: 64 });

		const userGuildId = `${interaction.member.id}-${interaction.guild.id}`;
		const user = await User.findOne({ where: { userGuildId } });
		if (!user || !user.walletAddress) return interaction.editReply({ content: 'Please register your wallet first.' });

		let auction;
		try {
			auction = await withdrawBid(interaction);
		}
		catch (error) {
			if (REFUSALS[error.message]) return interaction.editReply({ content: REFUSALS[error.message] });
			throw error;
		}

		await refreshOpenAuction(auction);
		return interaction.editReply({ content: 'Your bid was withdrawn.' });
	},
};
