const { Op } = require('sequelize');
const { FactionScore } = require('../src/db');
const { weekKey, previousWeekKey } = require('./period');

/**
 * Factions in fights. Monsters belong to Margaretha or Cerberon; a player who
 * has joined a faction deals RIVAL_DAMAGE_BONUS more damage to the other
 * faction's monsters, and each rival monster they defeat scores a point for
 * their faction in the server's weekly standings.
 *
 * Players store the name of their faction's role, which a server can rename,
 * so it is matched against the names saved by /setup factions.
 */

const FACTIONS = ['Margaretha', 'Cerberon'];
const RIVAL_DAMAGE_BONUS = 0.15;

// 'Margaretha', 'Cerberon', or null for a Wanderer (or a faction we can't place).
const playerFaction = (player, guild) => {
	const name = player.faction?.trim().toLowerCase();
	if (!name) return null;
	if (guild?.margarethaName && name === guild.margarethaName.trim().toLowerCase()) return 'Margaretha';
	if (guild?.cerberonName && name === guild.cerberonName.trim().toLowerCase()) return 'Cerberon';
	return FACTIONS.find((faction) => faction.toLowerCase() === name) ?? null;
};

const isRival = (faction, monsterFaction) =>
	Boolean(faction && FACTIONS.includes(monsterFaction) && faction !== monsterFaction);

// The server's display name for a faction (its role name), if it has one.
const factionLabel = (faction, guild) =>
	(faction === 'Margaretha' ? guild?.margarethaName : guild?.cerberonName) || faction;

const addFactionPoint = async (guildID, faction, now = Date.now()) => {
	const where = { guildID, faction, weekKey: weekKey(now) };
	await FactionScore.findOrCreate({ where, defaults: { ...where, score: 0 } });
	await FactionScore.increment({ score: 1 }, { where });
};

// { thisWeek: { Margaretha, Cerberon }, lastWeek: { … } } for a server.
const standings = async (guildID, now = Date.now()) => {
	const keys = { thisWeek: weekKey(now), lastWeek: previousWeekKey(now) };
	const rows = await FactionScore.findAll({ where: { guildID, weekKey: { [Op.in]: Object.values(keys) } } });
	const table = (key) => Object.fromEntries(FACTIONS.map((faction) =>
		[faction, rows.find((row) => row.weekKey === key && row.faction === faction)?.score ?? 0]));
	return { thisWeek: table(keys.thisWeek), lastWeek: table(keys.lastWeek) };
};

module.exports = { FACTIONS, RIVAL_DAMAGE_BONUS, playerFaction, isRival, factionLabel, addFactionPoint, standings };
