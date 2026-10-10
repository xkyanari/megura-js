const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sequelize } = require('../src/db');
const { listMigrations, sqlStatements, runMigrations, isApplied } = require('../scripts/migrate');
const { closeAll } = require('./helpers');

const DB = path.resolve(__dirname, '../src/db');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
const dirFor = (name, files) => {
	const dir = path.join(tmp, name);
	fs.mkdirSync(dir);
	for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content);
	return dir;
};
// a .js migration that appends its name to the mt_log table
const jsMigration = (name, { fail = false } = {}) => `
const { sequelize } = require(${JSON.stringify(DB)});
module.exports.migrate = async ({ dryRun }) => {
	${fail ? 'throw new Error(\'boom\');' : ''}
	if (!dryRun) await sequelize.query('INSERT INTO mt_log (name) VALUES (?)', { replacements: [${JSON.stringify(name)}] });
};`;
const logged = async () => (await sequelize.query('SELECT name FROM mt_log ORDER BY id'))[0].map((row) => row.name);
const recorded = async () => (await sequelize.query('SELECT name FROM `_migrations` WHERE name LIKE \'9999-%\' ORDER BY name'))[0].map((row) => row.name);
const quiet = { log: () => undefined };

before(async () => {
	await sequelize.sync();
	await sequelize.query('DROP TABLE IF EXISTS mt_log, mt_sql');
	await sequelize.query('CREATE TABLE mt_log (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50))');
	// this test database only: the first test checks a dry run doesn't create the table
	await sequelize.query('DROP TABLE IF EXISTS `_migrations`');
});
after(async () => {
	await sequelize.query('DROP TABLE IF EXISTS mt_log, mt_sql');
	await sequelize.query('DELETE FROM `_migrations` WHERE name LIKE \'9999-%\'');
	fs.rmSync(tmp, { recursive: true, force: true });
	await closeAll();
});

describe('migration runner', () => {
	test('the shipped migrations are found in date order, .sql included', () => {
		const names = listMigrations().map((m) => m.name);
		assert.deepEqual(names, [...names].sort());
		assert.ok(names.includes('2026-10-auction-bigint') && names.includes('2026-10-crafting'));
		for (const migration of listMigrations().filter((m) => m.kind === 'js')) {
			assert.equal(typeof require(migration.file).migrate, 'function', `${migration.name} exports migrate()`);
		}
	});

	test('.sql files split into statements without comments', () => {
		assert.deepEqual(sqlStatements('-- a comment\nUPDATE a SET b = 1;\n\nALTER TABLE a\n\tMODIFY b INT;\n'), ['UPDATE a SET b = 1', 'ALTER TABLE a\n\tMODIFY b INT']);
	});

	test('a dry run on a database that never ran one doesn\'t even create the table', async () => {
		const dir = dirFor('fresh', { '9999-00-fresh.js': jsMigration('fresh') });
		assert.deepEqual(await runMigrations({ sequelize, dir, dryRun: true, ...quiet }), ['9999-00-fresh']);
		const [tables] = await sequelize.query('SHOW TABLES');
		assert.ok(!tables.some((row) => Object.values(row).includes('_migrations')), 'no _migrations table');
		assert.equal(await isApplied(sequelize, '9999-00-fresh'), false);
		assert.deepEqual(await logged(), []);
		// the shipped migrations that record themselves are read-only in a dry run too
		const { migrate } = require('../scripts/migrations/2026-10-remove-crypto');
		await migrate({ dryRun: true, ...quiet });
		const [tablesAfter] = await sequelize.query('SHOW TABLES');
		assert.ok(!tablesAfter.some((row) => Object.values(row).includes('_migrations')));
	});

	test('a dry run changes nothing; a real run applies pending ones in order, once', async () => {
		await sequelize.query('CREATE TABLE IF NOT EXISTS `_migrations` (`name` VARCHAR(100) PRIMARY KEY, `appliedAt` DATETIME NOT NULL)');
		const dir = dirFor('ok', {
			'9999-02-second.js': jsMigration('second'),
			'9999-01-first.js': jsMigration('first'),
			'9999-03-third.sql': '-- makes a table\nCREATE TABLE mt_sql (id INT);\nINSERT INTO mt_sql VALUES (7);\n',
			'README.md': 'not a migration',
		});

		assert.deepEqual(await runMigrations({ sequelize, dir, dryRun: true, ...quiet }), ['9999-01-first', '9999-02-second', '9999-03-third']);
		assert.deepEqual(await logged(), []);
		assert.deepEqual(await recorded(), []);

		assert.deepEqual(await runMigrations({ sequelize, dir, ...quiet }), ['9999-01-first', '9999-02-second', '9999-03-third']);
		assert.deepEqual(await logged(), ['first', 'second']);
		assert.deepEqual((await sequelize.query('SELECT id FROM mt_sql'))[0], [{ id: 7 }]);
		assert.deepEqual(await recorded(), ['9999-01-first', '9999-02-second', '9999-03-third']);

		assert.deepEqual(await runMigrations({ sequelize, dir, ...quiet }), [], 'nothing left to run');
		assert.deepEqual(await logged(), ['first', 'second']);
	});

	test('one that recorded itself is skipped; a failure stops the run, leaving later ones pending', async () => {
		await sequelize.query('INSERT INTO `_migrations` (name, appliedAt) VALUES (\'9999-04-done\', NOW())');
		const dir = dirFor('failing', {
			'9999-04-done.js': jsMigration('done'),
			'9999-05-breaks.js': jsMigration('breaks', { fail: true }),
			'9999-06-after.js': jsMigration('after'),
		});
		await assert.rejects(runMigrations({ sequelize, dir, ...quiet }), /boom/);
		assert.deepEqual(await logged(), ['first', 'second'], 'neither the recorded nor the later one ran');
		assert.ok(!(await recorded()).includes('9999-05-breaks'));
		assert.ok(!(await recorded()).includes('9999-06-after'));
	});
});
