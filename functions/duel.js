const { setTimeout: wait } = require('node:timers/promises');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { sequelize, Player, Iura, moveIura } = require('../src/db');
const { expPoints, duel_expGained } = require('../src/vars');
const { simulateBattle } = require('./battle');
const leveling = require('./level');
const levelcheck = require('./levelup');

/**
 * Duels (/duel and the "Request for Duel" user command): the challenger fights
 * the target, and the winner takes 40% of the loser's wallet.
 *
 * The payout is worked out when the battle ends, from the loser's wallet as it
 * is then (locked), and moved in one transaction, so it is always a whole
 * number and can never take the loser below zero.
 */

const PAYOUT_SHARE = 0.4;
const MIN_WALLET = 100;
// How far apart in total health two players may be
const MAX_HEALTH_GAP = 15000;

// The two players' profiles in this server, with their wallets.
const loadDuelists = async (guildID, challengerId, targetId) => {
	const players = await Player.findAll({
		where: { discordID: [challengerId, targetId], guildID },
		include: 'iura',
	});
	return {
		challenger: players.find((p) => p.discordID === challengerId) ?? null,
		target: players.find((p) => p.discordID === targetId) ?? null,
	};
};

// Why these two can't duel, or null if they can. Profiles must already be loaded.
const duelRefusal = (challenger, target, targetUser) => {
	if (!target) return `${targetUser.tag ?? targetUser.username} does not have a voyager profile yet.`;
	if (Math.abs(target.totalHealth - challenger.totalHealth) >= MAX_HEALTH_GAP) {
		return 'Your rank is inappropriate to fight this player.';
	}
	if (!challenger.iura || challenger.iura.walletAmount < MIN_WALLET) {
		return `You do not have sufficient balance to duel! Please carry at least $${MIN_WALLET} IURA first.`;
	}
	if (!target.iura || target.iura.walletAmount < MIN_WALLET) {
		return 'This player does not have enough balance to be attacked.';
	}
	return null;
};

/**
 * Pays the winner 40% of the loser's wallet, and gives the challenger their
 * duel rewards if they won. Returns the amount moved.
 */
const settleDuel = ({ winner, loser, challengerWon }) => sequelize.transaction(async (transaction) => {
	// lock both wallets in account order, so two duels between the same pair settling at once can't deadlock
	const wallets = await Iura.findAll({
		where: { accountID: [winner.accountID, loser.accountID] },
		order: [['accountID', 'ASC']],
		transaction,
		lock: transaction.LOCK.UPDATE,
	});
	const wallet = wallets.find((w) => w.accountID === loser.accountID);
	const amount = Math.floor(Math.max(wallet?.walletAmount ?? 0, 0) * PAYOUT_SHARE);

	if (amount > 0) {
		await moveIura(loser.accountID, 'wallet', null, amount, transaction);
		await moveIura(winner.accountID, null, 'wallet', amount, transaction);
	}
	if (challengerWon) {
		await Player.increment(
			{ iuraEarned: amount, expGained: duel_expGained, duelKills: 1 },
			{ where: { accountID: winner.accountID }, transaction },
		);
	}
	return amount;
});

const profileButtons = () => new ActionRowBuilder().addComponents(
	new ButtonBuilder().setCustomId('profile').setEmoji('👤').setLabel('Profile').setStyle(ButtonStyle.Success),
	new ButtonBuilder().setCustomId('inventory').setEmoji('🛄').setLabel('Inventory').setStyle(ButtonStyle.Primary),
	new ButtonBuilder().setCustomId('shop').setEmoji('🛒').setLabel('Shop').setStyle(ButtonStyle.Danger),
);

// Levels the challenger up if the duel's EXP took them over the threshold.
const checkLevelUp = async (interaction, challenger) => {
	await challenger.reload();
	if (challenger.expGained >= expPoints(challenger.level)) {
		const levelUp = await leveling(challenger.guildID, challenger.discordID);
		await levelcheck(interaction, levelUp.level);
	}
};

const SELF_DUEL = 'There is a saying that goes:```“The attempt to force human beings to despise themselves is what I call hell.” ― Andre Malraux```Sorry, I cannot allow that.';

// Runs a whole duel between the member who used the command and `targetUser`.
const runDuel = async (interaction, targetUser, { delay = wait } = {}) => {
	const { user, guild, client } = interaction;

	if (user.id === targetUser.id) return interaction.reply(SELF_DUEL);
	if (client.user.id === targetUser.id) return interaction.reply('I don\'t engage in battles.');
	if (targetUser.bot) return interaction.reply('You cannot duel with bots.');

	await interaction.deferReply();

	const { challenger, target } = await loadDuelists(guild.id, user.id, targetUser.id);
	if (!challenger) throw new Error('profile not found');

	const refusal = duelRefusal(challenger, target, targetUser);
	if (refusal) return interaction.editReply(refusal);

	await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xcd7f32).setDescription('The battle commences!')] });
	await delay(1000);
	await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(0xcd7f32).setDescription('Starting in 10 seconds...')] });
	await delay(10000);

	const winner = await simulateBattle(interaction, challenger, target);
	if (winner !== challenger && winner !== target) return;

	const challengerWon = winner === challenger;
	const amount = await settleDuel({
		winner,
		loser: challengerWon ? target : challenger,
		challengerWon,
	});

	await interaction.channel.send('The battle has concluded.');
	await interaction.followUp({
		content: challengerWon
			? `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${amount} IURA\`\n- \`${duel_expGained} EXP\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`
			: `👎 **YOU LOST!** You lost the following from the battle: \n\n- \`${amount} IURA\`\n\n> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`,
		components: [profileButtons()],
	});

	if (challengerWon) await checkLevelUp(interaction, challenger);
};

module.exports = {
	PAYOUT_SHARE,
	MAX_HEALTH_GAP,
	loadDuelists,
	duelRefusal,
	settleDuel,
	runDuel,
};
