const { Player } = require("../src/db");
const {
  baseHealth,
  baseAttack,
  baseDefense,
  attackPerLevel,
  defensePerLevel,
  healthPerLevel,
} = require("../src/vars");

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
  try {
    const player = await Player.findOne({ where: { discordID } });

    // adding a level
    player.expGained = 0;
    player.level += 1;

    // updating the totalAttack
    const newBaseAttack = attackPerLevel(player.level);
    const attackAddition = newBaseAttack - baseAttack;
    player.totalAttack += attackAddition;

    // updating the totalDefense
    const newBaseDefense = defensePerLevel(player.level);
    const defenseAddition = newBaseDefense - baseDefense;
    player.totalDefense += defenseAddition;

    // updating the totalHealth
    const newBaseHealth = healthPerLevel(player.level);
    const healthAddition = newBaseHealth - baseHealth;
    player.totalHealth += healthAddition;

    await player.save();
    return {
      level: player.level,
    };
  } catch (error) {
    console.error(error);
  }
};
