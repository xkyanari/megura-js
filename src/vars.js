
// for attacks and duels
const min_atk_rate = 0.1;
const min_def_rate = 0.1;
const blessing = 50;
const crit_rate = 0.25;
const duel_expGained = '20';
const duel_iuraGained = '25';

const levelUp = (level) => 100 * level || 1;

module.exports = {
    min_atk_rate,
    min_def_rate,
    blessing,
    crit_rate,
    duel_expGained,
    duel_iuraGained,
    levelUp
};