const { randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { sequelize, Giveaway, GiveawayEntry } = require('../src/db');

/**
 * Giveaways: members enter with a button, and when the time is up Dahlia
 * draws the winners at random. Ending, rerolling and cancelling each lock the
 * giveaway row and act only from the expected status, so a scheduled end that
 * races a manual /giveaway end, or a double click, can't draw twice.
 */

const MIN_DURATION = 60 * 1000;
const MAX_DURATION = 30 * 24 * 60 * 60 * 1000;
const MAX_WINNERS = 20;

// Picks up to `count` distinct IDs at random, skipping any in `exclude`.
const pickWinners = (userIds, count, exclude = []) => {
	const pool = [...new Set(userIds)].filter((id) => !exclude.includes(id));
	const winners = [];
	while (winners.length < count && pool.length) {
		winners.push(pool.splice(randomInt(pool.length), 1)[0]);
	}
	return winners;
};

const createGiveaway = ({ guildID, channelID, hostID, prize, winnerCount, endsAt }) =>
	Giveaway.create({ guildID, channelID, hostID, prize, winnerCount, endsAt });

// Enters the member, or takes them out if they had already entered.
// Returns { ok: true, entered, count } or { ok: false, reason: 'closed' }.
const toggleEntry = async (giveawayId, userId) => {
	const giveaway = await Giveaway.findByPk(giveawayId);
	if (!giveaway || giveaway.status !== 'running' || giveaway.endsAt <= new Date()) {
		return { ok: false, reason: 'closed' };
	}

	let entered = true;
	try {
		await GiveawayEntry.create({ giveawayId, userId });
	}
	catch (error) {
		if (!(error instanceof UniqueConstraintError)) throw error;
		await GiveawayEntry.destroy({ where: { giveawayId, userId } });
		entered = false;
	}

	const count = await GiveawayEntry.count({ where: { giveawayId } });
	return { ok: true, entered, count };
};

const lockGiveaway = (id, transaction) =>
	Giveaway.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

// Draws the winners of a running giveaway. Returns { giveaway, winners, entrantCount },
// or null if it isn't running (already ended or cancelled).
const endGiveaway = (id) => sequelize.transaction(async (transaction) => {
	const giveaway = await lockGiveaway(id, transaction);
	if (!giveaway || giveaway.status !== 'running') return null;

	const entries = await GiveawayEntry.findAll({ where: { giveawayId: id }, transaction });
	const winners = pickWinners(entries.map((entry) => entry.userId), giveaway.winnerCount);

	giveaway.status = 'ended';
	giveaway.winners = winners;
	await giveaway.save({ transaction });
	return { giveaway, winners, entrantCount: entries.length };
});

// Draws `count` new winners for an ended giveaway, never repeating a previous winner.
// Returns { giveaway, winners } (winners may be empty), or null if it hasn't ended.
const rerollGiveaway = (id, count = 1) => sequelize.transaction(async (transaction) => {
	const giveaway = await lockGiveaway(id, transaction);
	if (!giveaway || giveaway.status !== 'ended') return null;

	const entries = await GiveawayEntry.findAll({ where: { giveawayId: id }, transaction });
	const previous = giveaway.winners ?? [];
	const winners = pickWinners(entries.map((entry) => entry.userId), count, previous);

	giveaway.winners = [...previous, ...winners];
	await giveaway.save({ transaction });
	return { giveaway, winners };
});

// Cancels a running giveaway without drawing. Returns the giveaway, or null if it isn't running.
const cancelGiveaway = (id) => sequelize.transaction(async (transaction) => {
	const giveaway = await lockGiveaway(id, transaction);
	if (!giveaway || giveaway.status !== 'running') return null;

	giveaway.status = 'cancelled';
	await giveaway.save({ transaction });
	return giveaway;
});

// --- Discord messages -------------------------------------------------------

const mentions = (ids) => ids.map(userMention).join(', ');

const giveawayEmbed = (giveaway, { entrantCount, winners } = {}) => {
	const endsAt = Math.floor(new Date(giveaway.endsAt).getTime() / 1000);
	const embed = new EmbedBuilder()
		.setTitle(`🎉 ${giveaway.prize}`)
		.setColor(giveaway.status === 'running' ? 0xcd7f32 : 0x808080)
		.setFooter({ text: `Giveaway ID: ${giveaway.id}` });

	const lines = [`Hosted by ${userMention(giveaway.hostID)}`];
	if (giveaway.status === 'running') {
		lines.push(`Ends <t:${endsAt}:R> (<t:${endsAt}:f>)`, `Winners: ${giveaway.winnerCount}`, '', 'Click **Enter** to join. Click again to leave.');
	}
	else if (giveaway.status === 'cancelled') {
		lines.push('This giveaway was cancelled.');
	}
	else {
		lines.push(`Ended <t:${endsAt}:f>`, `Entries: ${entrantCount ?? 0}`);
		lines.push(winners?.length ? `Winners: ${mentions(winners)}` : 'No winners: nobody entered.');
	}
	return embed.setDescription(lines.join('\n'));
};

const enterButton = (giveaway, disabled = false) => new ActionRowBuilder().addComponents(
	new ButtonBuilder()
		.setCustomId(`giveaway-enter:${giveaway.id}`)
		.setEmoji('🎉')
		.setLabel('Enter')
		.setStyle(ButtonStyle.Primary)
		.setDisabled(disabled),
);

const fetchGiveawayChannel = (client, giveaway) =>
	client.channels.fetch(giveaway.channelID).catch(() => null);

// Updates the giveaway post to show the result and announces the winners.
const announceGiveawayEnd = async (client, { giveaway, winners, entrantCount }) => {
	const channel = await fetchGiveawayChannel(client, giveaway);
	if (!channel) return;

	if (giveaway.messageID) {
		const message = await channel.messages.fetch(giveaway.messageID).catch(() => null);
		await message?.edit({
			embeds: [giveawayEmbed(giveaway, { entrantCount, winners })],
			components: [enterButton(giveaway, true)],
		});
	}

	const content = winners.length
		? `🎉 Congratulations ${mentions(winners)}! You won **${giveaway.prize}**.`
		: `The giveaway for **${giveaway.prize}** ended with no entries.`;
	await channel.send({ content, allowedMentions: { users: winners } });
};

const announceReroll = async (client, { giveaway, winners }) => {
	const channel = await fetchGiveawayChannel(client, giveaway);
	if (!channel) return;

	const content = winners.length
		? `🎉 New winner${winners.length > 1 ? 's' : ''} for **${giveaway.prize}**: ${mentions(winners)}!`
		: `No one else is left to draw for **${giveaway.prize}**.`;
	await channel.send({ content, allowedMentions: { users: winners } });
};

const announceCancel = async (client, giveaway) => {
	const channel = await fetchGiveawayChannel(client, giveaway);
	const message = giveaway.messageID && await channel?.messages.fetch(giveaway.messageID).catch(() => null);
	await message?.edit({ embeds: [giveawayEmbed(giveaway)], components: [enterButton(giveaway, true)] });
};

// Runs a job queued on client.giveawayQueue (see events/ClientReady.js).
const processGiveawayJob = async (client, { giveawayId }) => {
	const result = await endGiveaway(giveawayId);
	if (result) await announceGiveawayEnd(client, result);
	return Boolean(result);
};

module.exports = {
	MIN_DURATION,
	MAX_DURATION,
	MAX_WINNERS,
	pickWinners,
	createGiveaway,
	toggleEntry,
	endGiveaway,
	rerollGiveaway,
	cancelGiveaway,
	giveawayEmbed,
	enterButton,
	announceGiveawayEnd,
	announceReroll,
	announceCancel,
	processGiveawayJob,
};
