const { userMention } = require('discord.js');
const { DELETE_DELAY, closeTicketFor } = require('../../functions/ticket');

const REFUSALS = {
	'not found': 'This ticket no longer exists.',
	'not allowed': 'Only the member who opened this ticket, or staff, can close it.',
	'already closed': 'This ticket is already closed.',
};

module.exports = {
	data: {
		name: 'ticket-close',
		cooldown: 3000,
	},
	async execute(interaction) {
		const [, id] = interaction.customId.split(':');
		const result = await closeTicketFor(interaction, Number(id));

		if (!result.ok) {
			return interaction.reply({ content: REFUSALS[result.reason], flags: 64 });
		}
		return interaction.reply({
			content: `🔒 Ticket closed by ${userMention(interaction.user.id)}. This channel will be deleted in ${DELETE_DELAY / 1000} seconds.`,
			allowedMentions: { parse: [] },
		});
	},
};
