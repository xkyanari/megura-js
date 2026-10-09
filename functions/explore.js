const { sequelize, Player, Monster, Exploration, moveIura } = require('../src/db');
const { rollLoot } = require('./loot');
const LOCATIONS = require('../assets/locations.json');

/**
 * Exploration mode. Eldelvain's locations (assets/locations.json) open up as
 * players level. Each player is in one location at a time: /attack draws its
 * monsters from there, with the location's reward bonus, and /explore search
 * turns up an event there. The first visit to a location pays a discovery
 * bonus. Players who never travel start at the first location.
 */

const START = LOCATIONS[0].name;
const DISCOVERY_IURA_PER_LEVEL = 25;
const FIND_IURA_PER_LEVEL = 10;
const SEARCH_COOLDOWN = 30 * 60 * 1000;

// what a search can turn up, with how often
const EVENTS = [
	{ type: 'item', weight: 30 },
	{ type: 'iura', weight: 25 },
	{ type: 'lore', weight: 20 },
	{ type: 'ambush', weight: 15 },
	{ type: 'nothing', weight: 10 },
];

const LORE = [
	'You find a torn page from Cerberon\'s journal: "The portal answers to grief. Margaretha knew this before I did."',
	'Scratched into a wall: "We have met before. We will meet again." The handwriting looks like yours.',
	'A faded banner bearing Margaretha\'s crest flutters in a wind you can\'t feel.',
	'You hear Dahlia\'s voice, faint and far away, counting down from a number you don\'t recognize.',
	'Footprints lead in a circle and stop exactly where you are standing.',
	'An old clock with no hands ticks steadily. Somewhere, a portal hums in time with it.',
];

const locationNamed = (name) => LOCATIONS.find((location) => location.name.toLowerCase() === String(name).trim().toLowerCase()) ?? null;

const unlockedFor = (level) => LOCATIONS.filter((location) => location.unlockLevel <= level);

const nextUnlock = (level) => LOCATIONS.find((location) => location.unlockLevel > level) ?? null;

// The player's exploration row, as it is (null if they have never explored).
const explorationOf = (accountID, options) => Exploration.findByPk(accountID, options);

// The location the player is exploring, or null if they have never explored.
const currentLocation = async (accountID) => {
	const row = await explorationOf(accountID);
	return row ? locationNamed(row.location) : null;
};

const pick = (entries, random) => {
	let roll = random() * entries.reduce((sum, entry) => sum + entry.weight, 0);
	for (const entry of entries) {
		roll -= entry.weight;
		if (roll < 0) return entry;
	}
	return entries[entries.length - 1];
};

/**
 * Moves the player to a location they have unlocked. The first visit pays a
 * discovery bonus. Returns { ok: true, location, discovered, bonus } or
 * { ok: false, reason } with reason 'unknown', 'locked' or 'here'.
 */
const travel = (accountID, name) => sequelize.transaction(async (transaction) => {
	const location = locationNamed(name);
	if (!location) return { ok: false, reason: 'unknown' };

	const player = await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
	if (!player) throw new Error('profile not found');
	if (location.unlockLevel > player.level) return { ok: false, reason: 'locked', location };

	const [row] = await Exploration.findOrCreate({
		where: { accountID },
		defaults: { accountID, location: START, discovered: [START] },
		transaction,
	});
	if (row.location === location.name && row.discovered.includes(location.name)) return { ok: false, reason: 'here', location };

	const discovered = !row.discovered.includes(location.name);
	const bonus = discovered ? DISCOVERY_IURA_PER_LEVEL * Math.max(player.level, 1) : 0;
	await row.update({
		location: location.name,
		discovered: discovered ? [...row.discovered, location.name] : row.discovered,
	}, { transaction });
	if (bonus) {
		await moveIura(accountID, null, 'wallet', bonus, transaction);
		await player.increment({ iuraEarned: bonus }, { transaction });
	}
	return { ok: true, location, discovered, bonus };
});

// A random monster from the location (any monster if it has none).
const monsterAt = async (location) => {
	const where = location ? { location: location.name } : {};
	const [monster] = await Monster.findAll({ where, order: sequelize.random(), limit: 1 });
	if (monster || !location) return monster ?? null;
	return monsterAt(null);
};

/**
 * Searches the player's current location. Returns { location, type, ... }:
 * 'item' (with item), 'iura' (with amount), 'lore' (with text), 'ambush'
 * (the caller starts the fight) or 'nothing'. The cooldown is the caller's.
 */
const search = async (player, { random = Math.random } = {}) => {
	const [row] = await Exploration.findOrCreate({
		where: { accountID: player.accountID },
		defaults: { accountID: player.accountID, location: START, discovered: [START] },
	});
	await row.increment({ searches: 1 });
	const location = locationNamed(row.location) ?? LOCATIONS[0];
	const { type } = pick(EVENTS, random);

	if (type === 'item') {
		const monster = await monsterAt(location);
		const item = monster && await rollLoot(player, monster.monsterName, { guaranteed: true, random });
		if (item) return { location, type, item };
		return { location, type: 'nothing' };
	}
	if (type === 'iura') {
		const amount = Math.max(Math.round(FIND_IURA_PER_LEVEL * Math.max(player.level, 1) * (1 + location.rewardBonus) * (1 + random())), 1);
		await player.addIura(amount);
		await player.increment({ iuraEarned: amount });
		return { location, type, amount };
	}
	if (type === 'lore') return { location, type, text: LORE[Math.floor(random() * LORE.length)] };
	return { location, type };
};

module.exports = {
	LOCATIONS,
	START,
	EVENTS,
	SEARCH_COOLDOWN,
	DISCOVERY_IURA_PER_LEVEL,
	locationNamed,
	unlockedFor,
	nextUnlock,
	currentLocation,
	travel,
	monsterAt,
	search,
};
