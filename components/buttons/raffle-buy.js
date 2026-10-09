const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Raffle } = require('../../src/db');
const { currencyName } = require('../../functions/raffle');

// Opens the "how many tickets?" form; components/modals/raffle-buy.js handles the answer.
module.exports = {
	data: {
		name: 'raffle-buy',
	},
	async execute(interaction) {
		const [, id] = interaction.customId.split(':');
		const raffle = await Raffle.findByPk(Number(id));
		if (!raffle || raffle.status !== 'running' || raffle.endsAt <= new Date()) {
			return interaction.reply({ content: 'This raffle has ended.', flags: 64 });
		}

		const quantity = new TextInputBuilder()
			.setCustomId('quantity')
			.setLabel(`Tickets (${raffle.ticketPrice} ${currencyName(raffle.currency)} each)`)
			.setPlaceholder(`1 to ${raffle.maxTicketsPerUser}`)
			.setStyle(TextInputStyle.Short)
			.setMaxLength(3)
			.setRequired(true);

		const modal = new ModalBuilder()
			.setCustomId(`raffle-buy:${raffle.id}`)
			.setTitle('Buy raffle tickets')
			.addComponents(new ActionRowBuilder().addComponents(quantity));

		return interaction.showModal(modal);
	},
};
