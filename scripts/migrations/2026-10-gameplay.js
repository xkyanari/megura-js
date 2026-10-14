/**
 * Brings an existing database in line with the October 2026 gameplay changes:
 *
 * 1. Adds Player.dailyStreak and Player.lastDailyAt (daily streaks).
 * 2. Adds global shop items from assets/item_db.json that the Shop table is
 *    missing (the new potions), without touching existing rows.
 * 3. Unequips what the new equipment rules no longer allow, giving the stats
 *    back: equipped consumables, extra copies of one item, and items over a
 *    category's slot limit (the highest-level ones stay on).
 *
 * Run once, with the bot stopped, after backing up the database:
 *   mysqldump -u <user> -p <database> Player Item Shop > gameplay-backup.sql
 *   node scripts/migrations/2026-10-gameplay.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-gameplay.js
 *
 * Safe to run again: each step skips what is already done.
 */

const { Op, DataTypes } = require('sequelize');
const { sequelize, Item, Shop } = require('../../src/db');
const { SLOT_LIMITS, changeEquipment } = require('../../functions/equipment');
const shopItems = require('../../assets/item_db.json');

const addStreakColumns = async (log, dryRun) => {
	const queryInterface = sequelize.getQueryInterface();
	const columns = await queryInterface.describeTable('Player');
	const wanted = {
		dailyStreak: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
		lastDailyAt: { type: DataTypes.DATE, allowNull: true },
	};
	for (const [name, definition] of Object.entries(wanted)) {
		if (columns[name]) continue;
		log(`add column Player.${name}`);
		if (!dryRun) await queryInterface.addColumn('Player', name, definition);
	}
};

const addMissingShopItems = async (log, dryRun) => {
	const existing = new Set((await Shop.findAll({ where: { guildID: null }, attributes: ['itemName'] })).map((s) => s.itemName));
	for (const item of shopItems) {
		if (existing.has(item.itemName)) continue;
		log(`add shop item ${item.itemName}`);
		if (!dryRun) await Shop.create(item);
	}
};

// What each player must take off: [{ accountID, item_ID, itemName, amount }].
const planUnequips = async () => {
	const equipped = await Item.findAll({ where: { equippedAmount: { [Op.gt]: 0 } } });
	const shop = new Map((await Shop.findAll({ where: { guildID: null } })).map((s) => [s.itemName, s]));

	const byPlayer = new Map();
	for (const item of equipped) {
		const shopItem = shop.get(item.itemName);
		// not a shop item: nothing to give back
		if (!shopItem) continue;
		if (!byPlayer.has(item.accountID)) byPlayer.set(item.accountID, []);
		byPlayer.get(item.accountID).push({ item, shopItem });
	}

	const plan = [];
	for (const [accountID, items] of byPlayer) {
		const kept = {};
		items.sort((a, b) => b.shopItem.level - a.shopItem.level || b.shopItem.price - a.shopItem.price);
		for (const { item, shopItem } of items) {
			const { category, item_ID, itemName } = shopItem;
			const limit = SLOT_LIMITS[category] ?? 0;
			kept[category] = kept[category] ?? 0;
			let amount = item.equippedAmount;
			if (kept[category] < limit) {
				kept[category] += 1;
				amount -= 1;
			}
			if (amount > 0) plan.push({ accountID, item_ID, itemName, amount });
		}
	}
	return plan;
};

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	await addStreakColumns(log, dryRun);
	await addMissingShopItems(log, dryRun);

	const plan = await planUnequips();
	for (const { accountID, item_ID, itemName, amount } of plan) {
		log(`player ${accountID}: unequip ${amount} × ${itemName}`);
		if (dryRun) continue;
		const result = await changeEquipment(accountID, item_ID, amount, false);
		if (!result.ok) log(`  skipped: ${result.reason}`);
	}
	return plan;
};

if (require.main === module) {
	const dryRun = process.argv.includes('--dry-run');
	migrate({ dryRun })
		.then((plan) => console.log(`${dryRun ? 'Would unequip' : 'Unequipped'} ${plan.length} item stack(s).`))
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		})
		.finally(() => sequelize.close());
}

module.exports = { migrate, planUnequips };
