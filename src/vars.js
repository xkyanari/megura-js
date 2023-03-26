
// for attacks and duels
const min_atk_rate = 0.1;
const min_def_rate = 0.1;
const blessing = 50;
const crit_rate = 0.25;
const criticalRate = 0.01;
const duel_expGained = 50;
const duel_iuraGained = 25;

const baseHealth = 2000;
const baseAttack = 500;
const baseDefense = 500;
const baseAttackMultiplier = 1.75;
const attackIncreasePerLevel = 0.05;
const levelHealthMultiplier = 175;
const levelDefenseMultiplier = 10;
const skillMultiplier = 0.05;
const attackMultiplier = (level) => baseAttackMultiplier + (skillMultiplier * level);

const expPoints = (level) => (50 * (level ** 2)) - (50 * level) || 1;

const attackPerLevel = (level) => baseAttack * (1 + attackIncreasePerLevel) ^ (level - 1);
const defensePerLevel = (level) => baseDefense + (levelDefenseMultiplier * level);
const healthPerLevel = (level) => baseHealth + (levelHealthMultiplier * level);

module.exports = {
    min_atk_rate,
    min_def_rate,
    blessing,
    crit_rate,
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
    criticalRate
};