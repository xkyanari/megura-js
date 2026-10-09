const { handleOrderButton } = require('../../functions/order');

module.exports = {
	data: {
		name: 'processing',
	},
	execute(interaction) {
		return handleOrderButton(interaction, 'processing');
	},
};
