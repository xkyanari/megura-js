const { randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const { sequelize, Player, Raffle, RaffleTicket, moveIura, escrowOres, releaseOres } = require('../src/db');

/**
 * Raffles: like giveaways, but members buy tickets with IURA or ores and each
 * ticket is a chance to win. Buying, ending, rerolling and cancelling all lock
 * the raffle row, so purchases are serialized per raffle (the per-member cap
 * can't be overshot) and a raffle is drawn or refunded exactly once.
 *
 * IURA spent on tickets leaves circulation; ores go to the server's wallet,
 * like special shop purchases. Cancelling refunds every ticket.
 */

const MAX_TICKET_PRICE = 1000000;
const MAX_TICKETS_PER_USER = 100;

const currencyName = (currency) => (currency === 'iura' ? 'IURA' : 'ores');

// Picks up to `count` distinct members, each with a chance proportional to their tickets.
const pickWeightedWinners = (tickets, count, exclude = []) => {
	const pool = tickets
		.filter((ticket) => ticket.count > 0 && !exclude.includes(ticket.userId))
		.map((ticket) => ({ userId: ticket.userId, count: ticket.count }));
	const winners = [];

	while (winners.length < count && pool.length) {
		const total = pool.reduce((sum, ticket) => sum + ticket.count, 0);
		let roll = randomInt(total);
		const index = pool.findIndex((ticket) => (roll -= ticket.count) < 0);
		winners.push(pool.splice(index, 1)[0].userId);
	}
	return winners;
};

const createRaffle = (fields) => Raffle.create(fields);

const lockRaffle = (id, transaction) =>
	Raffle.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });

const findProfile = (raffle, userId, transaction) =>
	Player.findOne({ where: { discordID: userId, guildID: raffle.guildID }, transaction });

// Takes `amount` from the member. Throws 'insufficient funds' without changing anything.
const charge = async (raffle, userId, amount, transaction) => {
	if (raffle.currency === 'ores') {
		return escrowOres(userId, raffle.guildID, amount, transaction);
	}
	const player = await findProfile(raffle, userId, transaction);
	return moveIura(player.accountID, 'wallet', null, amount, transaction);
};

// Gives `amount` back. Returns false if the member no longer has a profile.
const refund = async (raffle, userId, amount, transaction) => {
	if (raffle.currency === 'ores') {
		return releaseOres(userId, raffle.guildID, amount, transaction);
	}
	const player = await findProfile(raffle, userId, transaction);
	if (!player) return false;
	await moveIura(player.accountID, null, 'wallet', amount, transaction);
	return true;
};

/**
 * Buys `quantity` tickets. Returns { ok: true, held, cost } or
 * { ok: false, reason } with reason 'closed', 'profile', 'cap' (with held and max)
 * or 'insufficient funds'.
 */
const buyTickets = (raffleId, userId, guildID, quantity) => sequelize.transaction(async (transaction) => {
	const raffle = await lockRaffle(raffleId, transaction);
	if (!raffle || raffle.guildID !== guildID || raffle.status !== 'running' || raffle.endsAt <= new Date()) {
		return { ok: false, reason: 'closed' };
	}
	if (!await findProfile(raffle, userId, transaction)) {
		return { ok: false, reason: 'profile' };
	}

	const ticket = await RaffleTicket.findOne({ where: { raffleId, userId }, transaction });
	const held = ticket?.count ?? 0;
	if (held + quantity > raffle.maxTicketsPerUser) {
		return { ok: false, reason: 'cap', held, max: raffle.maxTicketsPerUser };
	}

	const cost = raffle.ticketPrice * quantity;
	try {
		await charge(raffle, userId, cost, transaction);
	}
	catch (error) {
		if (error.message === 'insufficient funds') return { ok: false, reason: 'insufficient funds' };
		throw error;
	}

	if (ticket) await ticket.increment({ count: quantity }, { transaction });
	else await RaffleTicket.create({ raffleId, userId, count: quantity }, { transaction });

	return { ok: true, held: held + quantity, cost, currency: raffle.currency };
});

// Draws the winners of a running raffle. Returns { raffle, winners, ticketCount, entrantCount }, or null.
const endRaffle = (id) => sequelize.transaction(async (transaction) => {
	const raffle = await lockRaffle(id, transaction);
	if (!raffle || raffle.status !== 'running') return null;

	const tickets = await RaffleTicket.findAll({ where: { raffleId: id }, transaction });
	const winners = pickWeightedWinners(tickets, raffle.winnerCount);

	raffle.status = 'ended';
	raffle.winners = winners;
	await raffle.save({ transaction });
	return {
		raffle,
		winners,
		ticketCount: tickets.reduce((sum, ticket) => sum + ticket.count, 0),
		entrantCount: tickets.length,
	};
});

// Draws `count` new winners for an ended raffle, never repeating a previous winner.
const rerollRaffle = (id, count = 1) => sequelize.transaction(async (transaction) => {
	const raffle = await lockRaffle(id, transaction);
	if (!raffle || raffle.status !== 'ended') return null;

	const tickets = await RaffleTicket.findAll({ where: { raffleId: id }, transaction });
	const previous = raffle.winners ?? [];
	const winners = pickWeightedWinners(tickets, count, previous);

	raffle.winners = [...previous, ...winners];
	await raffle.save({ transaction });
	return { raffle, winners };
});

// Cancels a running raffle and refunds every ticket, all or nothing.
// Returns { raffle, refunded, unrefunded } (member counts), or null if it isn't running.
const cancelRaffle = (id) => sequelize.transaction(async (transaction) => {
	const raffle = await lockRaffle(id, transaction);
	if (!raffle || raffle.status !== 'running') return null;

	const tickets = await RaffleTicket.findAll({ where: { raffleId: id }, transaction });
	let refunded = 0;
	let unrefunded = 0;
	for (const ticket of tickets) {
		if (ticket.count < 1) continue;
		if (await refund(raffle, ticket.userId, ticket.count * raffle.ticketPrice, transaction)) refunded++;
		else unrefunded++;
	}

	raffle.status = 'cancelled';
	await raffle.save({ transaction });
	return { raffle, refunded, unrefunded };
});

// --- Discord messages -------------------------------------------------------

const mentions = (ids) => ids.map(userMention).join(', ');

const raffleEmbed = (raffle, { ticketCount, entrantCount, winners } = {}) => {
	const endsAt = Math.floor(new Date(raffle.endsAt).getTime() / 1000);
	const price = `${raffle.ticketPrice} ${currencyName(raffle.currency)}`;
	const lines = [`Hosted by ${userMention(raffle.hostID)}`];

	if (raffle.status === 'running') {
		lines.push(
			`Ticket price: **${price}** (up to ${raffle.maxTicketsPerUser} per member)`,
			`Ends <t:${endsAt}:R> (<t:${endsAt}:f>)`,
			`Winners: ${raffle.winnerCount}`,
			'',
			'Click **Buy tickets**. Every ticket is a chance to win.',
		);
	}
	else if (raffle.status === 'cancelled') {
		lines.push('This raffle was cancelled and every ticket was refunded.');
	}
	else {
		lines.push(`Ended <t:${endsAt}:f>`, `Tickets: ${ticketCount ?? 0} from ${entrantCount ?? 0} members`);
		lines.push(winners?.length ? `Winners: ${mentions(winners)}` : 'No winners: nobody bought a ticket.');
	}

	return new EmbedBuilder()
		.setTitle(`🎟️ ${raffle.prize}`)
		.setColor(raffle.status === 'running' ? 0xcd7f32 : 0x808080)
		.setDescription(lines.join('\n'))
		.setFooter({ text: `Raffle ID: ${raffle.id}` });
};

const buyButton = (raffle, disabled = false) => new ActionRowBuilder().addComponents(
	new ButtonBuilder()
		.setCustomId(`raffle-buy:${raffle.id}`)
		.setEmoji('🎟️')
		.setLabel('Buy tickets')
		.setStyle(ButtonStyle.Primary)
		.setDisabled(disabled),
);

const fetchRaffleMessage = async (client, raffle) => {
	const channel = await client.channels.fetch(raffle.channelID).catch(() => null);
	const message = channel && raffle.messageID
		? await channel.messages.fetch(raffle.messageID).catch(() => null)
		: null;
	return { channel, message };
};

const announceRaffleEnd = async (client, result) => {
	const { raffle, winners } = result;
	const { channel, message } = await fetchRaffleMessage(client, raffle);
	if (!channel) return;

	await message?.edit({ embeds: [raffleEmbed(raffle, result)], components: [buyButton(raffle, true)] });
	const content = winners.length
		? `🎟️ Congratulations ${mentions(winners)}! You won **${raffle.prize}**.`
		: `The raffle for **${raffle.prize}** ended with no tickets sold.`;
	await channel.send({ content, allowedMentions: { users: winners } });
};

const announceRaffleReroll = async (client, { raffle, winners }) => {
	const { channel } = await fetchRaffleMessage(client, raffle);
	if (!channel) return;

	const content = winners.length
		? `🎟️ New winner${winners.length > 1 ? 's' : ''} for **${raffle.prize}**: ${mentions(winners)}!`
		: `No one else is left to draw for **${raffle.prize}**.`;
	await channel.send({ content, allowedMentions: { users: winners } });
};

const announceRaffleCancel = async (client, { raffle }) => {
	const { message } = await fetchRaffleMessage(client, raffle);
	await message?.edit({ embeds: [raffleEmbed(raffle)], components: [buyButton(raffle, true)] });
};

// Runs a job queued on client.raffleQueue (see events/ClientReady.js).
const processRaffleJob = async (client, { raffleId }) => {
	const result = await endRaffle(raffleId);
	if (result) await announceRaffleEnd(client, result);
	return Boolean(result);
};

module.exports = {
	MAX_TICKET_PRICE,
	MAX_TICKETS_PER_USER,
	currencyName,
	pickWeightedWinners,
	createRaffle,
	buyTickets,
	endRaffle,
	rerollRaffle,
	cancelRaffle,
	raffleEmbed,
	buyButton,
	announceRaffleEnd,
	announceRaffleReroll,
	announceRaffleCancel,
	processRaffleJob,
};
