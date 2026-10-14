const { sequelize, Player, Item, Shop, moveIura } = require('../src/db');

/**
 * Selling global-shop items back for SELL_SHARE of their price (at least 1
 * IURA each). Only unequipped copies can be sold. Runs in one transaction with
 * the player's row locked, so double clicks can't sell more than they have.
 */

const SELL_SHARE = 0.4;

const sellPrice = (price) => Math.max(Math.floor(price * SELL_SHARE), 1);

/**
 * Sells `amount` of the shop item `itemID`. Returns { ok: true, itemName, total }
 * or { ok: false, reason } with reason 'amount', 'not found' or 'not enough'.
 */
const sellItem = (accountID, itemID, amount) => {
	if (!Number.isSafeInteger(amount) || amount < 1) return Promise.resolve({ ok: false, reason: 'amount' });

	return sequelize.transaction(async (transaction) => {
		await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
		// only the global shop buys back: special-shop items are server rewards
		const shopItem = await Shop.findOne({ where: { item_ID: itemID, guildID: null }, transaction });
		if (!shopItem) return { ok: false, reason: 'not found' };

		const item = await Item.findOne({
			where: { accountID, itemName: shopItem.itemName },
			transaction,
			lock: transaction.LOCK.UPDATE,
		});
		if (!item || item.quantity < amount) return { ok: false, reason: 'not enough' };

		const total = sellPrice(shopItem.price) * amount;
		const quantity = item.quantity - amount;
		// the last copy sold: its upgrade (functions/crafting.js) goes with it
		await item.update({ quantity, ...(quantity + item.equippedAmount === 0 ? { upgradeLevel: 0 } : {}) }, { transaction });
		await moveIura(accountID, null, 'wallet', total, transaction);
		await Player.increment({ iuraEarned: total, itemsTraded: amount }, { where: { accountID }, transaction });
		return { ok: true, itemName: shopItem.itemName, total };
	});
};

module.exports = { SELL_SHARE, sellPrice, sellItem };
