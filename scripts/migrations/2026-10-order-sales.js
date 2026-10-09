/**
 * Adds Order.price (ores paid) and Order.orderedAt for sales tracking (/sales).
 * Orders placed before this have neither; /sales counts them but can't date
 * them or add them to revenue.
 *
 * Run once, with the bot stopped, before starting the version that needs it:
 *   node scripts/migrations/2026-10-order-sales.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-order-sales.js
 *
 * Safe to run again: it only adds the columns that are missing.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../../src/db');

const COLUMNS = {
	price: { type: DataTypes.INTEGER, allowNull: true },
	orderedAt: { type: DataTypes.DATE, allowNull: true },
};

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	const queryInterface = sequelize.getQueryInterface();
	const existing = await queryInterface.describeTable('Order');
	const missing = Object.keys(COLUMNS).filter((column) => !existing[column]);
	log(missing.length ? `Add Order columns: ${missing.join(', ')}` : 'Order already has price and orderedAt.');
	if (dryRun) return missing;
	for (const column of missing) await queryInterface.addColumn('Order', column, COLUMNS[column]);
	return missing;
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
