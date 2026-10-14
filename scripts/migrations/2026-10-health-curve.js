/**
 * Moves every player onto the new health curve (src/vars.js healthPerLevel):
 * each player's health goes up by the difference between the new and the old
 * curve at their level, so health from gear is kept.
 *
 * Run once, with the bot stopped, after backing up the database:
 *   mysqldump -u <user> -p <database> Player > health-backup.sql
 *   node scripts/migrations/2026-10-health-curve.js --dry-run   # shows what would change
 *   node scripts/migrations/2026-10-health-curve.js
 *
 * It records itself in the _migrations table, so running it again does nothing.
 */

const { ensureTable, isApplied } = require('../migrate');
const { sequelize, Player } = require('../../src/db');
const { healthPerLevel, legacyHealthPerLevel } = require('../../src/vars');

const NAME = '2026-10-health-curve';

const migrate = async ({ dryRun = false, log = console.log } = {}) => {
	// reads only, so a dry run changes nothing
	if (await isApplied(sequelize, NAME)) {
		log(`${NAME} has already been applied.`);
		return 0;
	}

	const players = await Player.findAll({ attributes: ['accountID', 'level', 'totalHealth'] });
	const changes = players
		.map((player) => ({ player, gain: healthPerLevel(player.level) - legacyHealthPerLevel(player.level) }))
		.filter(({ gain }) => gain !== 0);
	log(`${changes.length} of ${players.length} player(s) gain health.`);
	if (dryRun) {
		for (const { player, gain } of changes.slice(0, 20)) log(`  player ${player.accountID} (level ${player.level}): +${gain}`);
		return changes.length;
	}

	await ensureTable(sequelize);
	await sequelize.transaction(async (transaction) => {
		for (const { player, gain } of changes) {
			await Player.increment({ totalHealth: gain }, { where: { accountID: player.accountID }, transaction });
		}
		await sequelize.query('INSERT INTO `_migrations` (`name`, `appliedAt`) VALUES (?, NOW())', { replacements: [NAME], transaction });
	});
	return changes.length;
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
