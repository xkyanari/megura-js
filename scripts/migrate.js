/**
 * Runs the database migrations in scripts/migrations/ that haven't run yet,
 * in name (date) order, and records each one in the `_migrations` table.
 *
 *   node scripts/migrate.js --dry-run   # lists what would run, changing nothing
 *   node scripts/migrate.js
 *
 * `.js` migrations export migrate({ dryRun, log }); `.sql` migrations are run
 * one statement at a time. Every migration is safe to run again (it skips
 * what is already done), so on a server where some were run by hand before
 * this runner existed, the first run simply records them.
 *
 * Stops at the first migration that fails, and exits non-zero.
 * scripts/update.sh runs this with the bot stopped, after a backup.
 */

const fs = require('node:fs');
const path = require('node:path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const TABLE = '_migrations';

// The migration files in run order: [{ name, file, kind: 'js' | 'sql' }].
const listMigrations = (dir = MIGRATIONS_DIR) => fs.readdirSync(dir)
	.filter((file) => /\.(js|sql)$/.test(file))
	.sort()
	.map((file) => ({ name: file.replace(/\.(js|sql)$/, ''), file: path.join(dir, file), kind: path.extname(file).slice(1) }));

// A .sql file's statements, without comments.
const sqlStatements = (content) => content
	.split('\n')
	.filter((line) => !line.trim().startsWith('--'))
	.join('\n')
	.split(/;\s*(?:\n|$)/)
	.map((statement) => statement.trim())
	.filter(Boolean);

const hasTable = async (sequelize) => {
	const [found] = await sequelize.query('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', { replacements: [TABLE] });
	return found.length > 0;
};

const ensureTable = (sequelize) =>
	sequelize.query(`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (\`name\` VARCHAR(100) PRIMARY KEY, \`appliedAt\` DATETIME NOT NULL)`);

// Whether the migration is recorded as run (false if the table doesn't exist yet). Reads only.
const isApplied = async (sequelize, name) => {
	if (!await hasTable(sequelize)) return false;
	const [rows] = await sequelize.query(`SELECT 1 FROM \`${TABLE}\` WHERE \`name\` = ?`, { replacements: [name] });
	return rows.length > 0;
};

const runMigrations = async ({ sequelize, dir = MIGRATIONS_DIR, dryRun = false, log = console.log } = {}) => {
	// a dry run changes nothing, not even this table: missing means nothing has run
	if (!dryRun) await ensureTable(sequelize);
	const [rows] = await hasTable(sequelize) ? await sequelize.query(`SELECT \`name\` FROM \`${TABLE}\``) : [[]];
	const done = new Set(rows.map((row) => row.name));
	const pending = listMigrations(dir).filter((migration) => !done.has(migration.name));

	if (!pending.length) {
		log('Database is up to date: no migrations to run.');
		return [];
	}
	log(`${dryRun ? 'Would run' : 'Running'} ${pending.length} migration(s): ${pending.map((m) => m.name).join(', ')}`);

	const applied = [];
	for (const migration of pending) {
		log(`→ ${migration.name}`);
		if (migration.kind === 'js') {
			const { migrate } = require(migration.file);
			if (typeof migrate !== 'function') throw new Error(`${migration.name} doesn't export migrate()`);
			await migrate({ dryRun, log: (line) => log(`  ${line}`) });
		}
		else if (!dryRun) {
			for (const statement of sqlStatements(fs.readFileSync(migration.file, 'utf8'))) await sequelize.query(statement);
		}
		if (!dryRun) {
			// some .js migrations record themselves; IGNORE keeps that row
			await sequelize.query(`INSERT IGNORE INTO \`${TABLE}\` (\`name\`, \`appliedAt\`) VALUES (?, NOW())`, { replacements: [migration.name] });
		}
		applied.push(migration.name);
	}
	log(dryRun ? 'Dry run: nothing was changed.' : `Done: ${applied.length} migration(s) applied.`);
	return applied;
};

if (require.main === module) {
	const { sequelize } = require('../src/db');
	runMigrations({ sequelize, dryRun: process.argv.includes('--dry-run') })
		.catch((error) => {
			console.error('Migration failed:', error);
			process.exitCode = 1;
		})
		.finally(() => sequelize.close());
}

module.exports = { MIGRATIONS_DIR, listMigrations, sqlStatements, ensureTable, isApplied, runMigrations };
