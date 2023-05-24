// main server ID
// const serverID = '1073827215957032960'; // dev
const serverID = "1032034043686035508"; // prod

// text command prefix
const prefix = "!";

// audit log directory
const logDir = "../logs";

// wanderer faction - can be changed to anything
const wanderer = "Wanderer";

// for attacks and duels
const criticalRate = 0.125;
const duel_expGained = 50;
const duel_iuraGained = 25;

// base stats
const baseHealth = 2000;
const baseAttack = 500;
const baseDefense = 500;
const baseAttackMultiplier = 1.75;
const attackIncreasePerLevel = 0.05;
const levelHealthMultiplier = 175;
const levelDefenseMultiplier = 10;
const skillMultiplier = 0.05;

// experience points
const expPoints = (level) => 50 * level ** 2 - 50 * level || 1;

// battle formula
const attackMultiplier = (level) =>
  baseAttackMultiplier + skillMultiplier * level;
const getCriticalHitRate = (level) => Math.min(level * criticalRate, 0.5);

// leveling bonuses
const attackPerLevel = (level) =>
  (baseAttack * (1 + attackIncreasePerLevel)) ^ (level - 1);
const defensePerLevel = (level) => baseDefense + levelDefenseMultiplier * level;
const healthPerLevel = (level) => baseHealth + levelHealthMultiplier * level;

module.exports = {
  serverID,
  prefix,
  logDir,
  wanderer,
  expPoints,
  duel_expGained,
  duel_iuraGained,
  baseHealth,
  baseAttack,
  baseDefense,
  attackPerLevel,
  defensePerLevel,
  healthPerLevel,
  attackMultiplier,
  getCriticalHitRate,
};
