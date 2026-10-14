const { Player } = require('./src/db');
const { attackPerLevel, defensePerLevel, healthPerLevel } = require('./src/vars');

// Update player stats based on level
async function updatePlayerStats() {
	const players = await Player.findAll();

	for (const player of players) {
		const totalAttack = attackPerLevel(player.level);
		const totalHealth = healthPerLevel(player.level);
		const totalDefense = defensePerLevel(player.level);

		await player.update({
			totalAttack: totalAttack,
			totalHealth: totalHealth,
			totalDefense: totalDefense,
		});
	}
}

updatePlayerStats().then(() => {
	console.log('Updated player stats');
}).catch((err) => {
	console.error('Failed to update player stats: ', err);
});
