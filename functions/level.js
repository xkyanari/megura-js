const { sequelize, Player } = require('../src/db');
const {
	attackPerLevel,
	defensePerLevel,
	healthPerLevel,
	expPoints,
} = require('../src/vars');

/**
 * Levels a player up as far as their EXP allows. Each stat grows by the
 * difference between its value at the new level and at the old one, so the
 * result is the same whether levels come one at a time or several at once.
 * Locks the player, so two rewards finishing together can't level up twice.
 */
module.exports = (guildID, discordID) => sequelize.transaction(async (transaction) => {
	const player = await Player.findOne({ where: { discordID, guildID }, transaction, lock: transaction.LOCK.UPDATE });

	const oldLevel = player.level;
	let { expGained } = player;
	let level = oldLevel;
	while (expGained >= expPoints(level)) {
		expGained -= expPoints(level);
		level += 1;
	}
	const levelsGained = level - oldLevel;

	if (levelsGained) {
		await player.update({
			level,
			expGained,
			totalAttack: player.totalAttack + attackPerLevel(level) - attackPerLevel(oldLevel),
			totalDefense: player.totalDefense + defensePerLevel(level) - defensePerLevel(oldLevel),
			totalHealth: player.totalHealth + healthPerLevel(level) - healthPerLevel(oldLevel),
		}, { transaction });
	}

	return { level, levelsGained };
});
