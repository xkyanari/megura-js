const { Player, sequelize } = require('./src/db');

// base stats
const baseHealth = 2000;
const baseAttack = 500;
const baseDefense = 500;

// scaling factors
const attackIncreasePerLevel = 0.05;  // 5% increase per level
const levelHealthMultiplier = 175;
const levelDefenseMultiplier = 10;

// leveling bonuses
const attackPerLevel = (level) =>
    Math.round(baseAttack * (1 + attackIncreasePerLevel) ** (level - 1));
const defensePerLevel = (level) =>
    baseDefense + levelDefenseMultiplier * (level - 1);
const healthPerLevel = (level) =>
    baseHealth + levelHealthMultiplier * (level - 1);

// Update player stats based on level
async function updatePlayerStats() {
    const players = await Player.findAll();

    for (let player of players) {
        const totalAttack = attackPerLevel(player.level);
        const totalHealth = healthPerLevel(player.level);
        const totalDefense = defensePerLevel(player.level);

        await player.update({
            totalAttack: totalAttack,
            totalHealth: totalHealth,
            totalDefense: totalDefense
        });
    }
}

updatePlayerStats().then(() => {
    console.log("Updated player stats");
}).catch((err) => {
    console.error("Failed to update player stats: ", err);
});
