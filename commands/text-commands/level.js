const levelcheck = require('../../functions/levelcheck');
const logger = require('../../src/logger');

module.exports = {
	name: 'level',
	description: 'Check your level',
	usage: '',
	async execute(message) {
		logger.log({
			level: 'info',
			message: `User: ${message.author.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await levelcheck(message);
	},
};
