const { handleOrderButton } = require('../../functions/order');

module.exports = {
	data: {
		name: 'completed',
	},
	execute(interaction) {
		return handleOrderButton(interaction, 'completed');
	},
};
