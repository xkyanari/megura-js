const { EmbedBuilder, userMention } = require('discord.js');
const { sequelize, Player, Guild, FactionScore, FactionContribution, FactionSeason, FactionConfig, moveIura } = require('../src/db');
const { FACTIONS, factionLabel } = require('./factions');
const { previousWeekKey } = require('./period');

/**
 * Faction seasons. Every Monday (UTC) last week's standings are settled in each
 * server: the faction with more points wins (a tie or an empty week has no
 * winner), and every member who scored for the winning side is paid IURA,
 * scaled by level and by their points against the week's top scorer. Each week
 * is settled once (FactionSeason row), so a retried or repeated job can't pay
 * twice. If the server set a champion role, it moves to the new winners.
 */

const SEASON_IURA_PER_LEVEL = 100;
const SEASON_CRON = '5 0 * * 1';

const rewardFor = (level, points, topPoints) =>
	Math.max(Math.round(SEASON_IURA_PER_LEVEL * Math.max(level, 1) * (0.5 + 0.5 * points / topPoints)), 1);

/**
 * Settles one server's week. Returns null if it was already settled, else
 * { guildID, weekKey, winner, scores, rewards: [{ discordID, points, iura }], previousIDs }.
 */
const settleSeason = (guildID, weekKey) => sequelize.transaction(async (transaction) => {
	const previous = await FactionSeason.findOne({ where: { guildID }, order: [['id', 'DESC']], transaction });
	const settled = await FactionSeason.findOne({ where: { guildID, weekKey }, transaction, lock: transaction.LOCK.UPDATE });
	if (settled) return null;

	const rows = await FactionScore.findAll({ where: { guildID, weekKey }, transaction });
	const scores = Object.fromEntries(FACTIONS.map((faction) => [faction, rows.find((row) => row.faction === faction)?.score ?? 0]));
	const [first, second] = [...FACTIONS].sort((a, b) => scores[b] - scores[a]);
	const winner = scores[first] > scores[second] ? first : null;

	const rewards = [];
	if (winner) {
		const contributions = await FactionContribution.findAll({
			where: { guildID, weekKey, faction: winner },
			order: [['points', 'DESC']],
			transaction,
		});
		const topPoints = contributions[0]?.points ?? 1;
		for (const contribution of contributions) {
			const player = await Player.findByPk(contribution.accountID, { transaction, lock: transaction.LOCK.UPDATE });
			if (!player) continue;
			const iura = rewardFor(player.level, contribution.points, topPoints);
			await moveIura(player.accountID, null, 'wallet', iura, transaction);
			await player.increment({ iuraEarned: iura }, { transaction });
			rewards.push({ discordID: player.discordID, points: contribution.points, iura });
		}
	}

	await FactionSeason.create({
		guildID,
		weekKey,
		winner,
		scores,
		rewardedIDs: rewards.map((reward) => reward.discordID),
	}, { transaction });
	return { guildID, weekKey, winner, scores, rewards, previousIDs: previous?.rewardedIDs ?? [] };
});

// Moves the champion role from last season's winners to this season's. Members who left are skipped.
const moveChampionRole = async (guild, roleID, previousIDs, newIDs) => {
	const role = await guild.roles.fetch(roleID).catch(() => null);
	if (!role) return false;
	const member = (id) => guild.members.fetch(id).catch(() => null);
	for (const id of previousIDs.filter((previousID) => !newIDs.includes(previousID))) {
		await (await member(id))?.roles.remove(role).catch(() => null);
	}
	for (const id of newIDs) {
		await (await member(id))?.roles.add(role).catch(() => null);
	}
	return true;
};

const seasonEmbed = (result, guildRow) => {
	const label = (faction) => factionLabel(faction, guildRow);
	const scoreLines = FACTIONS.map((faction) => `${result.winner === faction ? '👑' : '▫️'} **${label(faction)}**: ${result.scores[faction]}`).join('\n');
	const top = result.rewards.slice(0, 3)
		.map((reward, i) => `${['🥇', '🥈', '🥉'][i]} ${userMention(reward.discordID)}: ${reward.points} point(s), ${reward.iura} IURA`)
		.join('\n');
	const headline = result.winner
		? `**${label(result.winner)}** wins the week! Every member who scored for them has been rewarded.`
		: 'The week ends without a winner.';
	return new EmbedBuilder()
		.setColor(0xcd7f32)
		.setTitle('⚔️ FACTION SEASON RESULTS')
		.setDescription([headline, scoreLines, top].filter(Boolean).join('\n\n'));
};

/**
 * Settles last week for every server with faction scores, then announces it
 * and moves champion roles where the server set them up. Safe to run again.
 */
const runSeasonJob = async (client, now = Date.now()) => {
	const weekKey = previousWeekKey(now);
	const guildIDs = (await FactionScore.findAll({ where: { weekKey }, attributes: ['guildID'], group: ['guildID'] })).map((row) => row.guildID);
	const results = [];
	for (const guildID of guildIDs) {
		try {
			const result = await settleSeason(guildID, weekKey);
			if (!result) continue;
			results.push(result);

			const config = await FactionConfig.findByPk(guildID);
			const guild = config && await client.guilds.fetch(guildID).catch(() => null);
			if (!guild) continue;
			if (config.roleID) await moveChampionRole(guild, config.roleID, result.previousIDs, result.rewards.map((r) => r.discordID));
			if (config.channelID) {
				const channel = await client.channels.fetch(config.channelID).catch(() => null);
				const guildRow = await Guild.findOne({ where: { guildID } });
				await channel?.send({ embeds: [seasonEmbed(result, guildRow)] }).catch(() => null);
			}
		}
		catch (error) {
			console.error(`Faction season for ${guildID} failed:`, error);
		}
	}
	return results;
};

// The last settled season in a server, or null.
const lastSeason = (guildID) => FactionSeason.findOne({ where: { guildID }, order: [['id', 'DESC']] });

module.exports = { SEASON_IURA_PER_LEVEL, SEASON_CRON, rewardFor, settleSeason, moveChampionRole, seasonEmbed, runSeasonJob, lastSeason };
