/**
 * Removes the Bitcoin auction feature from an existing database:
 *
 * 1. Drops the Bid, Auction, AuctionClosure, AuctionItem and User tables
 *    (auction bids and the wallet registrations used to bid). Their data is deleted.
 * 2. Drops Guild.auctionChannelID, auctionwebhookId and auctionwebhookToken.
 *
 * Run once, with the bot stopped, after backing up the database:
 *   mysqldump -u <user> -p <database> Bid Auction AuctionClosure AuctionItem User Guild > auction-backup.sql
 *   node scripts/migrations/2026-10-remove-auctions.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-remove-auctions.js
 *
 * It records itself in the _migrations table, so running it again does nothing.
 */

const { ensureTable, isApplied } = require('../migrate');
const { sequelize } = require('../../src/db');

const NAME = '2026-10-remove-auctions';
// dependants first, so foreign keys never block a drop
const TABLES = ['Bid', 'Auction', 'AuctionClosure', 'AuctionItem', 'User'];
const GUILD_COLUMNS = ['auctionChannelID', 'auctionwebhookId', 'auctionwebhookToken'];

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	// reads only, so a dry run changes nothing
	if (await isApplied(sequelize, NAME)) {
		log(`${NAME} has already been applied.`);
		return;
	}

	const queryInterface = sequelize.getQueryInterface();
	const [rows] = await sequelize.query('SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()');
	const existingTables = new Set(rows.map((row) => row.name));
	const tables = TABLES.filter((table) => existingTables.has(table));
	const guildColumns = Object.keys(await queryInterface.describeTable('Guild'));
	const columns = GUILD_COLUMNS.filter((column) => guildColumns.includes(column));
	log(`Drop tables: ${tables.join(', ') || 'none left'}`);
	log(`Drop Guild columns: ${columns.join(', ') || 'none left'}`);
	if (dryRun) return;

	// MySQL commits DROP and ALTER TABLE on its own, so these run before the marker is written
	for (const table of tables) await queryInterface.dropTable(table);
	for (const column of columns) await queryInterface.removeColumn('Guild', column);
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

module.exports = { migrate, TABLES, GUILD_COLUMNS };
