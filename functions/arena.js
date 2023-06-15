const { EmbedBuilder } = require("@discordjs/builders");
const { attackMultiplier } = require("../src/vars");
const { getDamage } = require("./battle");
const battleUp = require('../functions/battleup');
const { Monster, sequelize } = require('../src/db');

const duelMessages = [
    "${winner.playerName} strikes a mighty blow, defeating ${loser.playerName} in a flurry of steel and grit!",
    "Like a bolt from the blue, ${winner.playerName} overpowers ${loser.playerName}!",
    "${winner.playerName} emerges victorious, leaving ${loser.playerName} to nurse their wounds!",
    "The crowd gasps as ${winner.playerName} skillfully outmaneuvers ${loser.playerName} to claim victory!",
    "With a final, decisive move, ${winner.playerName} brings down ${loser.playerName}. The crowd roars in approval!",
    "A swift and deadly dance ends with ${winner.playerName} as the victor, while ${loser.playerName} must accept defeat.",
    "Despite a hard-fought battle, ${loser.playerName} falls to the superior skill of ${winner.playerName}.",
    "The tension breaks as ${winner.playerName} lands the final blow, defeating ${loser.playerName}!",
    "The arena echoes with the clash of steel, but it's ${winner.playerName} who stands victorious over ${loser.playerName}.",
    "A titanic struggle ends as ${winner.playerName} vanquishes ${loser.playerName}, demonstrating their superior skill!"
];

const duel = async (interaction, player1, player2) => {
    const damage1 = Math.round(getDamage(player1, player2, attackMultiplier(player1.level)).finalDamage);
    const damage2 = Math.round(getDamage(player2, player1, attackMultiplier(player2.level)).finalDamage);

    let winner, loser;

    if (damage1 > damage2) {
        winner = player1;
        loser = player2;
    } else if (damage2 > damage1) {
        winner = player2;
        loser = player1;
    } else {
        winner = Math.random() < 0.5 ? player1 : player2;
        loser = winner === player1 ? player2 : player1;
    }

    await battleUp(interaction, winner, loser);
    
    const message = duelMessages[Math.floor(Math.random() * duelMessages.length)];
    const filledMessage = message.replace('${winner.playerName}', winner.playerName).replace('${loser.playerName}', loser.playerName);
    const embed = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setDescription(filledMessage);
    await interaction.channel.send({ embeds: [embed] });

    return winner;
};

const monsterBattle = async (interaction, winner) => {
    const [monster] = await Monster.findAll({
        order: sequelize.random(),
        limit: 1,
    });

    const bossObj = {
        playerName: monster.monsterName,
        level: winner.level + monster.level * 2,
        totalHealth: Math.round(monster.totalHealth + winner.totalHealth + 30000),
        totalAttack: Math.round(monster.totalAttack + winner.totalAttack + 5000),
        totalDefense: Math.round(monster.totalDefense + winner.totalDefense + 5000),
        user: {
            displayAvatarURL: function() {
                return monster.imageURL;
            }
        }
    };
    console.log(bossObj);

    const wait = require('node:timers/promises').setTimeout;
    const embed1 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('Uh-oh!')
        .setDescription('Suddenly, the ground trembles as a fearsome creature crashes into the arena!\nA mighty boss monster has arrived to challenge the champion!');

    // announce the winner
    await interaction.channel.send({ embeds: [embed1] });

    await wait(1000);

    const embed2 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('The atmosphere crackles with tension...')
        .setDescription(`Will ${winner.playerName} save the day?`);

    await interaction.channel.send({ embeds: [embed2] });

    await wait(1000);

    const embed3 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('The monster rose up intimidating the hero!')
        .setDescription(`**ROOOAAAARRRRRRRR!!**`);

    await interaction.channel.send({ embeds: [embed3] });

    await wait(1000);

    const winnerBattle = await duel(interaction, winner, bossObj);

    if (winnerBattle === bossObj) {
        const embed4 = new EmbedBuilder()
            .setColor(0xcd7f32)
            .setTitle('Victory Lost!')
            .setDescription(`In a shocking turn of events, even the mighty champion, ${winner.playerName}, falls before the overwhelming power of the boss. The arena is left in awe, witnessing the limits of mortal strength.`);

        return await interaction.channel.send({ embeds: [embed4] });
    }

    const embed5 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('Another Legendary Victory!')
        .setDescription(`With a final, decisive strike, ${winner.playerName} defeats the boss monster and emerges as the true champion of the arena!`);

    return await interaction.channel.send({ embeds: [embed5] });
};

const arenaBattle = async (interaction, players) => {
    const wait = require('node:timers/promises').setTimeout;
    await wait(10000);

    const embed1 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setDescription('Let the duels commence!');
    await interaction.channel.send({ embeds: [embed1] });

    while (players.length > 1) {
        let player1 = players[Math.floor(Math.random() * players.length)];
        let player2;
        do {
            player2 = players[Math.floor(Math.random() * players.length)];
        } while (player1 === player2);

        let winner = await duel(interaction, player1, player2);
        players = players.filter(player => player !== (winner === player1 ? player2 : player1));

        await wait(2000);
    }

    const embed2 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('Victory!')
        .setDescription(`${players[0].playerName} is the last one standing!`);

    // announce the winner
    await interaction.channel.send({ embeds: [embed2] });
    await wait(5000);
    await monsterBattle(interaction, players[0]);
};

module.exports = {
    arenaBattle,
};