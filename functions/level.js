const { Player } = require('../src/db');
const {
	baseHealth,
	baseAttack,
	baseDefense,
	attackPerLevel,
	defensePerLevel,
	healthPerLevel,
	expPoints,
} = require('../src/vars');

module.exports = async (guildID, discordID) => {
	try {
		const player = await Player.findOne({ where: { discordID, guildID } });

		let levelsGained = 0;

		while (player.expGained >= expPoints(player.level + levelsGained)) {
			player.expGained -= expPoints(player.level + levelsGained);
			levelsGained += 1;
		}

		player.level += levelsGained;

		// Update the totalAttack
		const newBaseAttack = attackPerLevel(player.level);
		const attackAddition = newBaseAttack - baseAttack;
		player.totalAttack += attackAddition * levelsGained;

		// Update the totalDefense
		const newBaseDefense = defensePerLevel(player.level);
		const defenseAddition = newBaseDefense - baseDefense;
		player.totalDefense += defenseAddition * levelsGained;

		// Update the totalHealth
		const newBaseHealth = healthPerLevel(player.level);
		const healthAddition = newBaseHealth - baseHealth;
		player.totalHealth += healthAddition * levelsGained;

		await player.save();
		return {
			level: player.level,
			levelsGained: levelsGained,
		};
	}
	catch (error) {
		console.error(error);
	}
};
