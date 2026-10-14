/**
 * Brawl wagers switched from ores to IURA. Adds Brawl.currency and marks every
 * existing brawl as 'ores', so stakes already escrowed in the guild wallet are
 * still refunded or paid out in ores. New brawls default to 'iura'.
 *
 * Run it before starting this version: the bot reads the column.
 *   node scripts/migrations/2026-10-brawl-iura.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-brawl-iura.js
 *
 * It records itself in the _migrations table, so running it again does nothing.
 */

const { DataTypes } = require('sequelize');
const { ensureTable, isApplied } = require('../migrate');
const { sequelize } = require('../../src/db');

const NAME = '2026-10-brawl-iura';

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	// reads only, so a dry run changes nothing
	if (await isApplied(sequelize, NAME)) {
		log(`${NAME} has already been applied.`);
		return;
	}

	const queryInterface = sequelize.getQueryInterface();
	const hasColumn = 'currency' in await queryInterface.describeTable('Brawl');
	const [[{ count }]] = await sequelize.query('SELECT COUNT(*) AS count FROM `Brawl`');
	log(hasColumn ? 'Brawl.currency already exists' : `Add Brawl.currency and mark ${count} existing brawl(s) as ores`);
	if (dryRun) return;

	// Adding the column with default 'ores' marks every existing brawl as ores in the same
	// statement; the second ALTER makes new brawls default to IURA. Both are safe to rerun
	// (the bot is stopped, so no brawls are created in between). MySQL commits ALTER TABLE
	// on its own, so these run before the marker is written.
	const column = (defaultValue) => ({ type: DataTypes.ENUM('iura', 'ores'), allowNull: false, defaultValue });
	if (!hasColumn) await queryInterface.addColumn('Brawl', 'currency', column('ores'));
	await queryInterface.changeColumn('Brawl', 'currency', column('iura'));
	await ensureTable(sequelize);
	await sequelize.query('INSERT INTO `_migrations` (`name`, `appliedAt`) VALUES (?, NOW())', { replacements: [NAME] });
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
