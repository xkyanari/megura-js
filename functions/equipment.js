const { Op } = require('sequelize');
const { sequelize, Player, Item, Shop } = require('../src/db');

/**
 * Equipping and unequipping items. Each change runs in one transaction with
 * the player's row locked, and only moves items the player actually has, so
 * stats can't be inflated with negative or oversized amounts.
 */

const MAX_EQUIPPED_KINDS = 5;
const DEFAULTS = { weapons: ['weapon', 'Basic Sword'], armor: ['armor', 'Basic Clothes'] };

/**
 * Equips (equip = true) or unequips `amount` of the shop item `itemID`.
 * Returns { ok: true, itemName } or { ok: false, reason } with reason
 * 'amount', 'not owned', 'level', 'limit' or 'not enough'.
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
			if (player.level < shopItem.level) return { ok: false, reason: 'level' };
			if (item.quantity < amount) return { ok: false, reason: 'not enough' };
			if (item.equippedAmount === 0) {
				const kinds = await Item.count({ where: { accountID, equippedAmount: { [Op.gt]: 0 } }, transaction });
				if (kinds >= MAX_EQUIPPED_KINDS) return { ok: false, reason: 'limit' };
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

		const stats = {
			totalHealth: player.totalHealth + sign * shopItem.totalHealth * amount,
			totalAttack: player.totalAttack + sign * shopItem.totalAttack * amount,
			totalDefense: player.totalDefense + sign * shopItem.totalDefense * amount,
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

module.exports = { MAX_EQUIPPED_KINDS, changeEquipment };
