const { QueryTypes } = require('sequelize');
const { sequelize, Player, QuestProgress, Exploration } = require('../src/db');
const { weekKey, thisWeekKeys } = require('./period');

/**
 * Leaderboards for /rankings and the weekly numbers on /profile. Every board
 * is limited to the server's own players: [{ playerName, value }], best first.
 */

const TOP = 10;

const top = (sql, replacements) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT })
	.then((rows) => rows.map((row) => ({ playerName: row.playerName, value: Number(row.value) })));

// A column of Player: duelKills, level, monsterKills, iuraEarned.
const topBy = async (guildID, attribute) =>
	(await Player.findAll({ where: { guildID }, order: [[attribute, 'DESC']], limit: TOP }))
		.map((player) => ({ playerName: player.playerName, value: player[attribute] ?? 0 }));

// Daily and weekly quests completed this week (UTC, from Monday).
const topQuestsThisWeek = (guildID, now = Date.now()) => top(
	'SELECT p.`playerName`, COUNT(*) AS `value` FROM `QuestProgress` q JOIN `Player` p ON p.`accountID` = q.`accountID` '
	+ 'WHERE p.`guildID` = ? AND q.`completed` = TRUE AND q.`periodKey` IN (?) '
	+ 'GROUP BY p.`accountID`, p.`playerName` ORDER BY `value` DESC, p.`accountID` ASC LIMIT ?',
	[guildID, thisWeekKeys(now), TOP],
);

const topDiscoveries = (guildID) => top(
	'SELECT p.`playerName`, JSON_LENGTH(e.`discovered`) AS `value` FROM `Exploration` e JOIN `Player` p ON p.`accountID` = e.`accountID` '
	+ 'WHERE p.`guildID` = ? AND JSON_LENGTH(e.`discovered`) > 0 ORDER BY `value` DESC, p.`accountID` ASC LIMIT ?',
	[guildID, TOP],
);

// Points scored for either faction this week.
const topFactionScorers = (guildID, now = Date.now()) => top(
	'SELECT p.`playerName`, SUM(c.`points`) AS `value` FROM `FactionContribution` c JOIN `Player` p ON p.`accountID` = c.`accountID` '
	+ 'WHERE c.`guildID` = ? AND p.`guildID` = ? AND c.`weekKey` = ? '
	+ 'GROUP BY p.`accountID`, p.`playerName` ORDER BY `value` DESC, p.`accountID` ASC LIMIT ?',
	[guildID, guildID, weekKey(now), TOP],
);

const questsDoneThisWeek = (accountID, now = Date.now()) =>
	QuestProgress.count({ where: { accountID, completed: true, periodKey: thisWeekKeys(now) } });

const placesDiscovered = async (accountID) =>
	(await Exploration.findByPk(accountID))?.discovered?.length ?? 0;

module.exports = { TOP, topBy, topQuestsThisWeek, topDiscoveries, topFactionScorers, questsDoneThisWeek, placesDiscovered };
