const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
	data: {
		name: 'brawl-start',
	},
	async execute(interaction) {
		const register = new ModalBuilder().setCustomId('brawl-register').setTitle('Register');

		const wager = new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('wager')
				.setLabel('Enter wager in IURA (minimum 1).')
				.setPlaceholder('Numbers only.')
				.setStyle(TextInputStyle.Short)
				.setRequired(true),
		);

		register.addComponents(wager);

		await interaction.showModal(register);
	},
};
