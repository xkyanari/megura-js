const logger = require('../../src/logger');
const { executeAttack } = require('../../functions/attack');

module.exports = {
	data: {
		name: 'attack',
		cooldown: 25000,
	},
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await executeAttack(interaction);
	},
};
