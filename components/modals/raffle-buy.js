const { buyTickets, currencyName } = require('../../functions/raffle');

const messages = {
	'closed': () => 'This raffle has ended.',
	'profile': () => 'You need a voyager profile to buy tickets. Type `/start` to create one.',
	'insufficient funds': () => 'You don\'t have enough to buy those tickets.',
	'cap': ({ held, max }) => `You can hold at most ${max} tickets for this raffle, and you already have ${held}.`,
};

module.exports = {
	data: {
		name: 'raffle-buy',
	},
	async execute(interaction) {
		const [, id] = interaction.customId.split(':');
		const input = interaction.fields.getTextInputValue('quantity').trim();
		const quantity = Number(input);

		if (!/^\d+$/.test(input) || quantity < 1) {
			return interaction.reply({ content: 'Please enter a whole number of tickets, at least 1.', flags: 64 });
		}

		const result = await buyTickets(Number(id), interaction.user.id, interaction.guild.id, quantity);
		if (!result.ok) {
			return interaction.reply({ content: messages[result.reason](result), flags: 64 });
		}

		return interaction.reply({
			content: `🎟️ Bought ${quantity} ticket${quantity > 1 ? 's' : ''} for ${result.cost} ${currencyName(result.currency)}. You now hold ${result.held}.`,
			flags: 64,
		});
	},
};
