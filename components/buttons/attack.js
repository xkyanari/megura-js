const { executeAttack } = require('../../functions/attack');

module.exports = {
	data: {
		name: 'attack',
		cooldown: 25000,
	},
	async execute(interaction) {

		await executeAttack(interaction);
	},
};
