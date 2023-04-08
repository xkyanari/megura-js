const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    attackMultiplier,
    getCriticalHitRate,
    expPoints,
    duel_iuraGained,
    duel_expGained,
} = require('../src/vars');
const leveling = require('../functions/level');

const getDamage = (player1, player2, criticalHitMultiplier) => {
  const damage = (player1.totalAttack * criticalHitMultiplier) - player2.totalDefense;
  const finalDamage = Math.max(damage, 0);

  const remainingHealth = player2.totalHealth - finalDamage;

  return {
    finalDamage,
    remainingHealth
  };
};

const attack = async (interaction, player1, player2, criticalHitRate) => {
    const isCriticalHit = Math.random() < criticalHitRate;
    const finalAttackMultiplier = isCriticalHit ? attackMultiplier(player1.level) * 2 : attackMultiplier(player1.level);
    const { finalDamage, remainingHealth } = getDamage(player1, player2, finalAttackMultiplier);

    let message = await interaction.channel.send(`${player1.playerName} attacks ${player2.playerName} for ${Math.round(finalDamage)} damage${isCriticalHit ? " (critical hit)!" : ""}. ${player2.playerName} has ${Math.max(0, Math.round(remainingHealth))} health remaining.`);

      if (Math.max(0, Math.round(remainingHealth)) === 0) {
        await message.edit(`${player2.playerName} dodged the final attack and gave up.`);
      }

    player2.totalHealth = remainingHealth;

    return remainingHealth;
};

const simulateBattle = async (interaction, player1, player2) => {
    const wait = require('node:timers/promises').setTimeout;
    const playerA = player1;
    const playerB = player2;

    // if ((playerB.totalHealth - playerA.totalHealth) >= 5000) return interaction.editReply("Your rank is too low to fight this player.");
    // if ((playerB.totalHealth - playerA.totalHealth) <= -5000) return interaction.editReply("Your rank is too high to fight this player.");

    // if (playerA.iura.walletAmount < 100) return interaction.editReply("You do not have sufficient balance to duel! Please carry at least $100 IURA first.");
    // if (playerB.iura.walletAmount < 100) return interaction.editReply("This player does not have enough balance to be attacked.");

    const button = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
            .setCustomId('profile')
            .setEmoji('👤')
            .setLabel('Profile')
            .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('inventory')
                .setEmoji('🛄')
                .setLabel('Inventory')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
            .setCustomId('shop')
            .setEmoji('🛒')
            .setLabel('Shop')
            .setStyle(ButtonStyle.Danger)
    );

    const criticalHitRateA = getCriticalHitRate(playerA.level);
    const criticalHitRateB = getCriticalHitRate(playerB.level);

    let remainingHealthA = playerA.totalHealth;
    let remainingHealthB = playerB.totalHealth;

    let winner = '';

    while (remainingHealthA > 0 && remainingHealthB > 0) {
        remainingHealthB = await attack(interaction, playerA, playerB, criticalHitRateA);
        
        if (remainingHealthB <= 0) {
            winner = playerA;
            await interaction.channel.send(`The battle has concluded.`);
            await interaction.followUp({content: `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${duel_iuraGained} IURA\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`, components: [button]});

            // await Iura.decrement({ walletAmount: duel_iuraGained }, { where: { accountID: playerB.iura.accountID } });
            // await Iura.increment({ walletAmount: duel_iuraGained }, { where: { accountID: playerA.iura.accountID } });
            // await playerA.increment({ iuraEarned: duel_iuraGained, expGained: duel_expGained, duelKills: 1 });

            // if (playerA.expGained > expPoints(playerA.level)) {
            //     const levelUp = await leveling(interaction.member.id);
            //     await interaction.channel.send(`\`${p1_name}\`, you have leveled up to **${levelUp.level}**!`);
            // }
            break;
        }
        
        await wait(1000);
        
        remainingHealthA = await attack(interaction, playerB, playerA, criticalHitRateB);
        
        if (remainingHealthA <= 0) {
            winner = playerB;
            await interaction.channel.send(`The battle has concluded.`);
            await interaction.followUp("👎 **YOU LOST!**");
            await interaction.channel.send({content: `> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`, components: [button]});
            // await Iura.increment({ walletAmount: duel_iuraGained }, { where: { accountID: accountID2 } });
            // await Iura.decrement({ walletAmount: duel_iuraGained }, { where: { accountID: accountID1 } });
            break;
        }
        
        await wait(1000);
    }
};

module.exports = { simulateBattle };