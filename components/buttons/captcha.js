const captcha = require('../../functions/captcha');

module.exports = {
	data: {
		name: 'captcha',
	},
	async execute(interaction) {
		await captcha(interaction);
	},
};
