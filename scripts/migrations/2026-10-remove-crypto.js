/**
 * Removes what is left of the blockchain features from an existing database:
 *
 * 1. Drops Player.linked, walletAddress, contractAddress and tokenID (NFT
 *    links, unused by the bot). Their data is deleted.
 * 2. Moves special-shop items in the removed categories (whitelist, nfts,
 *    crypto) to "digital", so they still show in the shop.
 *
 * Run once, with the bot stopped, after backing up the database:
 *   mysqldump -u <user> -p <database> Player Shop > crypto-backup.sql
 *   node scripts/migrations/2026-10-remove-crypto.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-remove-crypto.js
 *
 * It records itself in the _migrations table, so running it again does nothing.
 */

const { ensureTable, isApplied } = require('../migrate');
const { sequelize, Shop } = require('../../src/db');

const NAME = '2026-10-remove-crypto';
const PLAYER_COLUMNS = ['linked', 'walletAddress', 'contractAddress', 'tokenID'];
const OLD_CATEGORIES = ['whitelist', 'nfts', 'crypto'];

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	// reads only, so a dry run changes nothing
	if (await isApplied(sequelize, NAME)) {
		log(`${NAME} has already been applied.`);
		return;
	}

	const existing = Object.keys(await sequelize.getQueryInterface().describeTable('Player'));
	const columns = PLAYER_COLUMNS.filter((column) => existing.includes(column));
	const items = await Shop.count({ where: { category: OLD_CATEGORIES } });
	log(`Drop Player columns: ${columns.join(', ') || 'none left'}`);
	log(`Move ${items} shop item(s) from ${OLD_CATEGORIES.join('/')} to digital`);
	if (dryRun) return;

	// MySQL commits ALTER TABLE on its own, so these run before the marker is written
	for (const column of columns) await sequelize.getQueryInterface().removeColumn('Player', column);
	await ensureTable(sequelize);
	await sequelize.transaction(async (transaction) => {
		await Shop.update({ category: 'digital' }, { where: { category: OLD_CATEGORIES }, transaction });
		await sequelize.query('INSERT INTO `_migrations` (`name`, `appliedAt`) VALUES (?, NOW())', { replacements: [NAME], transaction });
	});
};

if (require.main === module) {
	migrate({ dryRun: process.argv.includes('--dry-run') })
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		})
		.finally(() => sequelize.close());
}

module.exports = { migrate, PLAYER_COLUMNS };
