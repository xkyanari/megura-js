const { handleOrderButton } = require('../../functions/order');

module.exports = {
	data: {
		name: 'cancelled',
	},
	execute(interaction) {
		return handleOrderButton(interaction, 'cancelled');
	},
};
