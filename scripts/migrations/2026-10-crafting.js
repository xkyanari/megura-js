/**
 * Brings an existing database in line with gear upgrades and crafting:
 *
 * 1. Adds Item.upgradeLevel (every item starts at +0).
 * 2. Adds the global shop items from assets/item_db.json that the Shop table
 *    is missing (materials, Ward Stone and the crafted gear), without
 *    touching existing rows.
 *
 * Run once, with the bot stopped, after backing up the database:
 *   mysqldump -u <user> -p <database> Item Shop > crafting-backup.sql
 *   node scripts/migrations/2026-10-crafting.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-crafting.js
 *
 * Safe to run again: each step skips what is already done.
 */

const { DataTypes } = require('sequelize');
const { sequelize, Shop } = require('../../src/db');
const shopItems = require('../../assets/item_db.json');

const addUpgradeColumn = async (log, dryRun) => {
	const columns = await sequelize.getQueryInterface().describeTable('Item');
	if (columns.upgradeLevel) return log('Item.upgradeLevel is already there.');
	log('Add column Item.upgradeLevel');
	if (!dryRun) await sequelize.getQueryInterface().addColumn('Item', 'upgradeLevel', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
};

const addMissingShopItems = async (log, dryRun) => {
	const existing = new Set((await Shop.findAll({ where: { guildID: null }, attributes: ['itemName'] })).map((s) => s.itemName));
	const missing = shopItems.filter((item) => !existing.has(item.itemName));
	log(missing.length ? `Add ${missing.length} shop item(s): ${missing.map((item) => item.itemName).join(', ')}` : 'The shop already has every item.');
	if (!dryRun) for (const item of missing) await Shop.create(item);
};

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	await addUpgradeColumn(log, dryRun);
	await addMissingShopItems(log, dryRun);
};

if (require.main === module) {
	migrate({ dryRun: process.argv.includes('--dry-run') })
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		})
		.finally(() => sequelize.close());
}

module.exports = { migrate };
