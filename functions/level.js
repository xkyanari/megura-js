const { Player } = require('../src/db');
const {
    baseHealth,
    baseAttack,
    baseDefense,
    attackPerLevel,
    defensePerLevel,
    healthPerLevel
} = require('../src/vars');

/**
 *  Player runs commands
 * => gains EXP
 * => levels up
 * => gains level (and reset to 0)
 * => base attack increases
 * => base defense increases
 * => base health increases
 */

module.exports = async (discordID) => {
    const checkLevel = await Player.findOne({ where: { discordID }});

    // adding a level
    checkLevel.expGained = 0;
    checkLevel.level += 1;

    // updating the totalAttack
    const newBaseAttack = attackPerLevel(checkLevel.level);
    const attackAddition = newBaseAttack - baseAttack;
    checkLevel.totalAttack += attackAddition;

    // updating the totalDefense
    const newBaseDefense = defensePerLevel(checkLevel.level);
    const defenseAddition = newBaseDefense - baseDefense;
    checkLevel.totalDefense += defenseAddition;

    // updating the totalHealth
    const newBaseHealth = healthPerLevel(checkLevel.level);
    const healthAddition = newBaseHealth - baseHealth;
    checkLevel.totalHealth += healthAddition;

    await checkLevel.save();
    return {
        level: checkLevel.level
    };
};