const { Op } = require('sequelize');
const { sequelize, Player, Item, Shop } = require('../src/db');

/**
 * Equipping and unequipping items. Each change runs in one transaction with
 * the player's row locked, and only moves items the player actually has, so
 * stats can't be inflated with negative or oversized amounts.
 *
 * One copy of an item can be equipped at a time, in a slot for its category.
 * Consumables aren't equipped: they are used up in battle (see functions/loot.js).
 */

const SLOT_LIMITS = { weapons: 1, armor: 3, miscellaneous: 1 };
const MAX_EQUIPPED_KINDS = Object.values(SLOT_LIMITS).reduce((sum, n) => sum + n, 0);
const DEFAULTS = { weapons: ['weapon', 'Basic Sword'], armor: ['armor', 'Basic Clothes'] };
// each upgrade level adds this share of the item's base stats
const UPGRADE_STEP = 0.1;

// An item's stats at an upgrade level: { totalHealth, totalAttack, totalDefense }.
const statsFor = (shopItem, upgradeLevel = 0) => {
	const scale = (value) => Math.round((value ?? 0) * (1 + UPGRADE_STEP * upgradeLevel));
	return {
		totalHealth: scale(shopItem.totalHealth),
		totalAttack: scale(shopItem.totalAttack),
		totalDefense: scale(shopItem.totalDefense),
	};
};

// How many items of this category the player has equipped.
const slotUsed = async (accountID, category, transaction) => {
	const equipped = await Item.findAll({ where: { accountID, equippedAmount: { [Op.gt]: 0 } }, transaction });
	if (!equipped.length) return 0;
	return Shop.count({
		where: { guildID: null, category, itemName: equipped.map((item) => item.itemName) },
		transaction,
	});
};

/**
 * Equips (equip = true) or unequips `amount` of the shop item `itemID`.
 * Equipping takes exactly one. Returns { ok: true, itemName } or
 * { ok: false, reason } with reason 'amount', 'not owned', 'level',
 * 'consumable', 'equipped', 'slot' or 'not enough'.
 */
const changeEquipment = (accountID, itemID, amount, equip) => {
	if (!Number.isSafeInteger(amount) || amount < 1) return Promise.resolve({ ok: false, reason: 'amount' });

	return sequelize.transaction(async (transaction) => {
		const player = await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
		// equipment only comes from the global shop
		const shopItem = await Shop.findOne({ where: { item_ID: itemID, guildID: null }, transaction });
		const item = shopItem && await Item.findOne({
			where: { accountID, itemName: shopItem.itemName },
			transaction,
			lock: transaction.LOCK.UPDATE,
		});
		if (!player || !item) return { ok: false, reason: 'not owned' };

		if (equip) {
			if (amount !== 1) return { ok: false, reason: 'amount' };
			if (!SLOT_LIMITS[shopItem.category]) return { ok: false, reason: 'consumable' };
			if (player.level < shopItem.level) return { ok: false, reason: 'level' };
			if (item.equippedAmount > 0) return { ok: false, reason: 'equipped' };
			if (item.quantity < amount) return { ok: false, reason: 'not enough' };
			if (await slotUsed(accountID, shopItem.category, transaction) >= SLOT_LIMITS[shopItem.category]) {
				return { ok: false, reason: 'slot' };
			}
		}
		else if (item.equippedAmount < amount) {
			return { ok: false, reason: 'not enough' };
		}

		const sign = equip ? 1 : -1;
		const equippedAmount = item.equippedAmount + sign * amount;
		await item.update({
			quantity: item.quantity - sign * amount,
			equippedAmount,
			equipped: equippedAmount > 0,
		}, { transaction });

		const itemStats = statsFor(shopItem, item.upgradeLevel);
		const stats = {
			totalHealth: player.totalHealth + sign * itemStats.totalHealth * amount,
			totalAttack: player.totalAttack + sign * itemStats.totalAttack * amount,
			totalDefense: player.totalDefense + sign * itemStats.totalDefense * amount,
		};
		const slot = DEFAULTS[shopItem.category];
		if (slot) {
			const [field, fallback] = slot;
			if (equip) stats[field] = shopItem.itemName;
			else if (equippedAmount === 0 && player[field] === shopItem.itemName) stats[field] = fallback;
		}
		await player.update(stats, { transaction });

		return { ok: true, itemName: shopItem.itemName };
	});
};

module.exports = { SLOT_LIMITS, MAX_EQUIPPED_KINDS, UPGRADE_STEP, statsFor, changeEquipment };
