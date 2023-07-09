const { EmbedBuilder } = require("@discordjs/builders");
const { attackMultiplier } = require("../src/vars");
const { getDamage } = require("./battle");
const battleUp = require('../functions/battleup');
const { Monster, sequelize, Guild } = require('../src/db');
const { duelMessages } = require("../assets/responses");
const wait = require('node:timers/promises').setTimeout;

const duelPlayer = async (interaction, player1, player2) => {
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
    const filledMessage = message.replace(new RegExp('\\${winner.playerName}', 'g'), winner.playerName)
        .replace(new RegExp('\\${loser.playerName}', 'g'), loser.playerName);
    const embed = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setDescription(filledMessage);
    await interaction.channel.send({ embeds: [embed] });

    let respawned = false;

    // Check if the loser has respawns left and if they win a 40% respawn chance
    if (loser.respawns > 0 && Math.random() < 0.4) {
        loser.respawns--;
        const embedRespawn = new EmbedBuilder()
            .setColor(0xcd7f32)
            .setDescription(`${loser.playerName} has resurrected! A rare turning point of the event!`);
        await interaction.channel.send({ embeds: [embedRespawn] });
        respawned = true;
    }

    return { winner, loser, respawn: respawned };
};

const duelMonster = async (interaction, player1, monster) => {
    const playerCriticalHitChance = Math.random() < 0.35; // 35% chance for player to get a critical hit
    const criticalHitMultiplier = playerCriticalHitChance ? 4 : 1; // Critical hit doubles the damage

    const playerDamage = Math.round(getDamage(player1, monster, criticalHitMultiplier).finalDamage);
    const bossDamage = Math.round(getDamage(monster, player1, 1).finalDamage);

    let winner, loser;

    if (playerDamage > bossDamage) {
        winner = player1;
        loser = monster;
    } else if (bossDamage > playerDamage) {
        winner = monster;
        loser = player1;
    } else {
        winner = Math.random() < 0.5 ? player1 : monster;
        loser = winner === player1 ? monster : player1;
    }

    await battleUp(interaction, winner, loser);

    await wait(2000);

    const message = duelMessages[Math.floor(Math.random() * duelMessages.length)];
    const filledMessage = message.replace(new RegExp('\\${winner.playerName}', 'g'), winner.playerName)
        .replace(new RegExp('\\${loser.playerName}', 'g'), loser.playerName);
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
        level: Math.round(winner.level + monster.level),
        totalHealth: Math.round(monster.totalHealth + winner.totalHealth),
        totalAttack: Math.round(monster.totalAttack + winner.totalAttack),
        totalDefense: Math.round(monster.totalDefense + winner.totalDefense),
        user: {
            displayAvatarURL: function () {
                return monster.imageURL;
            }
        }
    };

    const embed1 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('Uh-oh!')
        .setDescription('Suddenly, the ground trembles as a fearsome creature crashes into the arena!\nA mighty boss monster has arrived to challenge the champion!');

    // announce the winner
    await interaction.channel.send({ embeds: [embed1] });

    await wait(10000);

    const embed2 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('The atmosphere crackles with tension...')
        .setDescription(`Will ${winner.playerName} save the day?`);

    await interaction.channel.send({ embeds: [embed2] });

    await wait(10000);

    const embed3 = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle('The monster rose up intimidating the hero!')
        .setDescription(`**ROOOAAAARRRRRRRR!!**`);

    await interaction.channel.send({ embeds: [embed3] });

    await wait(10000);

    const winnerBattle = await duelMonster(interaction, winner, bossObj);

    await wait(10000);

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
    try {
        const guildCheck = await Guild.findOne({ where: { guildID: interaction.guild.id } });
        await wait(10000);

        const embed1 = new EmbedBuilder()
            .setColor(0xcd7f32)
            .setDescription('Let the duels commence!');
        await interaction.channel.send({ embeds: [embed1] });

        while (players.length > 1) {
            try {
                console.log(`Starting new round. Current players: ${players.length}`);
                let player1 = players.shift();
                let player2Index;
                let player2;
        
                do {
                    player2Index = Math.floor(Math.random() * players.length);
                    player2 = players[player2Index];
                    if (player1 === player2) {
                        console.log("Selected the same player for both player1 and player2. Selecting a new player2.");
                        player2Index = (player2Index + 1) % players.length;
                        player2 = players[player2Index];
                    }
                } while (player1 === player2);
        
                players.splice(player2Index, 1);
        
                let duelResult = await duelPlayer(interaction, player1, player2);
                if (duelResult.respawn) {
                    players.unshift(duelResult.loser);
                }
                players.push(duelResult.winner);
        
                await wait(10000);
            } catch (error) {
                console.error("An error occurred during the arena battle:", error);
            }
        }        

        const embed2 = new EmbedBuilder()
            .setColor(0xcd7f32)
            .setTitle('Victory!')
            .setDescription(`${players[0].playerName} is the last one standing!`);

        // announce the winner
        await interaction.channel.send({ embeds: [embed2] });

        if (guildCheck && guildCheck.arenaBoss) {
            await wait(15000);
            await monsterBattle(interaction, players[0]);
        }
    } catch (error) {
        console.error(error);
    }
};

module.exports = {
    arenaBattle,
};