const { executeBid } = require('../../functions/executeBid');
const { auctionsEnabled } = require('../../src/vars');

module.exports = {
	// off unless config.json enables auctions (see src/vars.js)
	isEnabled: auctionsEnabled,
	data: {
		name: 'placeBid2',
	},
	async execute(interaction) {
		await executeBid(interaction, 822358);
	},
};
