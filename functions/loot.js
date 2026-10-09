const { Op } = require('sequelize');
const { sequelize, Player, Item, Shop } = require('../src/db');
const lootTable = require('../assets/loot_db.json');

/**
 * Monster drops and consumables for /attack.
 *
 * A win has a DROP_CHANCE of dropping one item: from the monster's entry in
 * loot_db.json if it has one, otherwise a miscellaneous or consumable item
 * from the global shop at or below the player's level, cheaper ones more often.
 * Only items that exist in the global shop are ever given.
 */

const DROP_CHANCE = 0.3;
const FALLBACK_CATEGORIES = ['miscellaneous', 'consumables'];

// Picks one entry, each weighted by weight(entry).
const pickWeighted = (entries, weight, random) => {
	const total = entries.reduce((sum, entry) => sum + weight(entry), 0);
	let roll = random() * total;
	for (const entry of entries) {
		roll -= weight(entry);
		if (roll < 0) return entry;
	}
	return entries[entries.length - 1];
};

// The shop items this monster can drop for a player of this level.
const dropPool = async (monsterName, level) => {
	const listed = lootTable.find((entry) => entry.monsterName === monsterName)?.loot;
	if (listed?.length) {
		const items = await Shop.findAll({ where: { guildID: null, itemName: listed } });
		if (items.length) return items;
	}
	return Shop.findAll({
		where: { guildID: null, category: FALLBACK_CATEGORIES, level: { [Op.lte]: level } },
	});
};

/**
 * Rolls for a drop and, on a hit, adds the item to the player's inventory.
 * Returns the item name, or null when nothing dropped. `guaranteed` skips the
 * roll (e.g. an item found by /explore search).
 */
const rollLoot = async (player, monsterName, { random = Math.random, guaranteed = false } = {}) => {
	if (!guaranteed && random() >= DROP_CHANCE) return null;

	const pool = await dropPool(monsterName, player.level);
	if (!pool.length) return null;

	const item = pickWeighted(pool, (entry) => 1 / Math.max(entry.price ?? 1, 1), random);
	await player.addItem(item.itemName, 1);
	await player.increment({ itemsEarned: 1 });
	return item.itemName;
};

// Takes one of the item out of the player's (unequipped) inventory. False if none is left.
const consumeItem = (accountID, itemName) => sequelize.transaction(async (transaction) => {
	await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
	const item = await Item.findOne({ where: { accountID, itemName }, transaction, lock: transaction.LOCK.UPDATE });
	if (!item || item.quantity < 1) return false;
	await item.update({ quantity: item.quantity - 1 }, { transaction });
	return true;
});

/**
 * The player's consumables, in the form simulateBattle takes: strongest heal
 * first, each with a consume() that uses one up.
 */
const loadConsumables = async (accountID) => {
	const owned = await Item.findAll({ where: { accountID, quantity: { [Op.gt]: 0 } } });
	if (!owned.length) return [];
	const shopItems = await Shop.findAll({
		where: { guildID: null, category: 'consumables', itemName: owned.map((item) => item.itemName) },
	});
	return shopItems
		.sort((a, b) => b.totalHealth - a.totalHealth || a.price - b.price)
		.map((shopItem) => ({
			itemName: shopItem.itemName,
			totalHealth: shopItem.totalHealth,
			totalAttack: shopItem.totalAttack,
			totalDefense: shopItem.totalDefense,
			consume: () => consumeItem(accountID, shopItem.itemName),
		}));
};

module.exports = { DROP_CHANCE, rollLoot, consumeItem, loadConsumables, pickWeighted };
