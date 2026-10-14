const { channelMention } = require('discord.js');
const { Guild } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { openTicket } = require('../../functions/ticket');

const REFUSALS = {
	'not set up': 'Tickets aren\'t set up in this server yet. Please let a server admin know.',
	'staff role missing': 'The ticket staff role no longer exists. Please ask a server admin to run `/ticket setup` again.',
};

module.exports = {
	data: {
		name: 'ticket-open',
		cooldown: 5000,
	},
	async execute(interaction) {
		const guildCheck = await Guild.findOne({ where: { guildID: interaction.guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasTickets')) {
			return;
		}

		await interaction.deferReply({ flags: 64 });
		const result = await openTicket(interaction);

		if (result.ok) {
			return interaction.editReply(`Your ticket is open: ${channelMention(result.channel.id)}`);
		}
		if (result.reason === 'already open') {
			const where = result.channelId ? `: ${channelMention(result.channelId)}` : '.';
			return interaction.editReply(`You already have an open ticket${where}`);
		}
		return interaction.editReply(REFUSALS[result.reason]);
	},
};
