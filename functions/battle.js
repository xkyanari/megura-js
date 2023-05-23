const {attackMultiplier, getCriticalHitRate} = require('../src/vars');

const getDamage = (player1, player2, criticalHitMultiplier) => {
    const damage = (player1.totalAttack * criticalHitMultiplier) - player2.totalDefense;
    const finalDamage = Math.max(damage, 0);

    const remainingHealth = player2.totalHealth - finalDamage;

    return {finalDamage, remainingHealth};
};

const attack = async (interaction, player1, player2, criticalHitRate) => {
  try {
    const isCriticalHit = Math.random() < criticalHitRate;
    const finalAttackMultiplier = isCriticalHit ? attackMultiplier(player1.level) * 2 : attackMultiplier(player1.level);
    const {finalDamage, remainingHealth} = getDamage(player1, player2, finalAttackMultiplier);

    let message = await interaction.channel.send(`${
        player1.playerName
    } attacks ${
        player2.playerName
    } for ${
        Math.round(finalDamage)
    } damage${
        isCriticalHit ? " (critical hit)!" : ""
    }. ${
        player2.playerName
    } has ${
        Math.max(0, Math.round(remainingHealth))
    } health remaining.`);

    if (Math.max(0, Math.round(remainingHealth)) === 0) {
        await message.edit(`${
            player2.playerName
        } dodged the final attack and gave up.`);
    }

    player2.totalHealth = remainingHealth;

    return remainingHealth;
  } catch (error) {
      console.error(error);
  }
};

const simulateBattle = async (interaction, player1, player2) => {
  try {
    const wait = require('node:timers/promises').setTimeout;
    const playerA = player1;
    const playerB = player2;

    const criticalHitRateA = getCriticalHitRate(playerA.level);
    const criticalHitRateB = getCriticalHitRate(playerB.level);

    let remainingHealthA = playerA.totalHealth;
    let remainingHealthB = playerB.totalHealth;

    let winner = '';

    while (remainingHealthA > 0 && remainingHealthB > 0) {
        remainingHealthB = await attack(interaction, playerA, playerB, criticalHitRateA);

        if (remainingHealthB <= 0) {
            winner = playerA;
            break;
        }

        await wait(1000);

        remainingHealthA = await attack(interaction, playerB, playerA, criticalHitRateB);

        if (remainingHealthA <= 0) {
            winner = playerB;
            break;
        }

        await wait(1000);
    }
    return winner;  
  } catch (error) {
      console.error(error);
  }
};

module.exports = {
    simulateBattle
};
