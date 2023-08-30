const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
	data: {
		name: 'brawl-start',
	},
	async execute(interaction) {
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';

		const register = new ModalBuilder().setCustomId('brawl-register').setTitle('Register');

		const wager = new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('wager')
				.setLabel(`Enter wager (Minimum: 1 ${oreEmoji}).`)
				.setPlaceholder('Numbers only.')
				.setStyle(TextInputStyle.Short)
				.setRequired(true),
		);

		register.addComponents(wager);

		await interaction.showModal(register);
	},
};
