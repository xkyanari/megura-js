const profile = require('../../functions/profile');

module.exports = {
	data: {
		name: 'profile',
	},
	async execute(interaction) {
		const member = interaction.user;

		await profile(interaction, member);
	},
};
