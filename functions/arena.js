const { EmbedBuilder } = require("@discordjs/builders");
const { attackMultiplier } = require("../src/vars");
const { getDamage } = require("./battle");
const battleUp = require('../functions/battleup');
const { Monster, sequelize, Guild } = require('../src/db');

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
    "A titanic struggle ends as ${winner.playerName} vanquishes ${loser.playerName}, demonstrating their superior skill!",
    "${winner.playerName} slips on a banana peel and still manages to defeat ${loser.playerName}!",
    "${winner.playerName} calls their mom for advice and it pays off! They defeat ${loser.playerName}!",
    "The crowd is stunned as ${winner.playerName} defeats ${loser.playerName} while juggling three apples!",
    "${winner.playerName} puts on a puppet show so captivating that ${loser.playerName} forgets to fight back!",
    "${loser.playerName} trips on their shoelaces, giving ${winner.playerName} an easy victory!",
    "${winner.playerName} uses their secret weapon – a squirrel – and startles ${loser.playerName} into defeat!",
    "${winner.playerName} convinces ${loser.playerName} to sit down and enjoy a picnic. When the fight is forgotten, ${winner.playerName} claims victory!",
    "After a fierce thumb war, ${winner.playerName} takes the win over ${loser.playerName}!",
    "In a surprising twist, ${winner.playerName} pulls out a chessboard. Several moves later, ${loser.playerName} admits defeat.",
    "${winner.playerName} pulls out a yo-yo and impresses ${loser.playerName} so much that they forget to fight back!",
    "Sources reveal that ${winner.playerName} defeated ${loser.playerName} in a thumb war championship. The thumb-wrestling world will never be the same!",
    "In a stunning display of skill and finesse, ${winner.playerName} gracefully danced their way to victory over ${loser.playerName}. Looks like they've got the moves like Jagger!",
    "In a clash of sportsmanship and hilarity, ${winner.playerName} defeated ${loser.playerName} in a game of competitive pillow fighting. Who knew fluffy weapons could be so effective?",
    "Witnesses report that ${winner.playerName} pulled off a victory over ${loser.playerName} that was so impressive, even their opponents couldn't help but applaud. Talk about a standing ovation!",
    "Hold onto your seats! ${winner.playerName} just served ${loser.playerName} a defeat so fierce, it sent their racket flying into the stands. I hope nobody got a concussion!",
    "News just in: ${winner.playerName} won the world championship in a fierce game of rock-paper-scissors-lizard-Spock against ${loser.playerName}. Sheldon Cooper would be proud!",
    "Looks like ${winner.playerName} just took out the trash, defeating ${loser.playerName} so convincingly that even the garbage collector couldn't handle the stench of their defeat!",
    "${loser.playerName} forgot to pay their electrical bills because ${winner.playerName} just stole their money!",
    "Another One Bites the Dust as ${winner.playerName} sent ${loser.playerName} packing with a defeat that would make Freddie Mercury proud!",
    "It's a game of gaming chairs and thrones, and ${winner.playerName} emerged as the rightful ruler, dethroning ${loser.playerName} and turning their defeat into a 'Game of Throws'.",
    "In a gaming universe far, far away, ${winner.playerName} embraced their inner Jedi and defeated ${loser.playerName} with a lightsaber-swinging skill that would make Darth Vader surrender!",
    "In a record-breaking feat, ${winner.playerName} crushed the karaoke competition, leaving ${loser.playerName} singing, 'I Will Survive!' in defeat.",
];

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
    const filledMessage = message.replace('${winner.playerName}', winner.playerName).replace('${loser.playerName}', loser.playerName);
    const embed = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setDescription(filledMessage);
    await interaction.channel.send({ embeds: [embed] });

    return winner;
};

const duelMonster = async (interaction, player1, monster) => {
    const playerCriticalHitChance = Math.random() < 0.35; // 35% chance for player to get a critical hit
    const criticalHitMultiplier = playerCriticalHitChance ? 2 : 1; // Critical hit doubles the damage

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
    console.log(bossObj);

    const wait = require('node:timers/promises').setTimeout;
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
    const guildCheck = await Guild.findOne({ where: { guildID: interaction.guild.id } });
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

        let winner = await duelPlayer(interaction, player1, player2);
        players = players.filter(player => player !== (winner === player1 ? player2 : player1));

        await wait(10000);
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
};

module.exports = {
    arenaBattle,
};