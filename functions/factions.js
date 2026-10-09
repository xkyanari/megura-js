const { Op } = require('sequelize');
const { FactionScore } = require('../src/db');
const { wanderer } = require('../src/vars');
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

// Whether the member has the role (discord.js member, or the raw role-ID list).
const hasRole = (member, roleID) => Boolean(roleID) && (member.roles?.cache?.has?.(roleID) ?? (Array.isArray(member.roles) && member.roles.includes(roleID)));

/**
 * Keeps the player's stored faction in step with the faction roles set up with
 * /setup factions: holding a role (picked with /factions join, or given by an
 * admin) is what makes a member of a faction, and losing it makes them a
 * Wanderer again. Without the member's roles (or the setup) nothing changes.
 * Returns the player's faction, as playerFaction does.
 */
const syncFaction = async (player, guild, member) => {
	if (!member?.roles || !guild?.margarethaID || !guild?.cerberonID) return playerFaction(player, guild);
	let name = wanderer;
	if (hasRole(member, guild.margarethaID)) name = guild.margarethaName || 'Margaretha';
	else if (hasRole(member, guild.cerberonID)) name = guild.cerberonName || 'Cerberon';
	if (player.faction !== name) await player.update({ faction: name });
	return playerFaction(player, guild);
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

module.exports = { FACTIONS, RIVAL_DAMAGE_BONUS, playerFaction, syncFaction, isRival, factionLabel, addFactionPoint, standings };
