const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const { Player, Guild } = require('../../src/db');
const { arenaBattle } = require('../../functions/arena');
const { footer } = require('../../src/vars');
const { validateFeature } = require('../../src/feature');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arena')
        .setDescription('Start an arena event!')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('start')
                .setDescription('Join the event.')
                .addStringOption((option) =>
                    option
                        .setName('timer')
                        .setDescription('Choose a number in minutes.')
                        .addChoices(
                            { name: '3 minutes', value: '3' },
                            { name: '5 minutes', value: '5' },
                            { name: '7 minutes', value: '7' },
                        )
                        .setRequired(false),
                )
                .addStringOption((option) =>
                    option
                        .setName('mode')
                        .setDescription('Set PVP mode.')
                        .addChoices(
                            { name: 'Battle Royale: Classic', value: 'classic' },
                            { name: 'Battle Royale: Evolving Classic', value: 'evolving' },
                            { name: 'Battle Royale: Evolving Deathmatch', value: 'evolving-deathmatch' },
                            { name: 'Battle Royale: Deathmatch', value: 'deathmatch' },
                        )
                        .setRequired(false)
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName('boss')
                .setDescription('Add the boss to challenge the winner?')
                .addBooleanOption((option) =>
                    option
                        .setName('show')
                        .setDescription('Choose one.'),
                ),
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('rules').setDescription('Show the rules.'),
        ),
    cooldown: 3000,
    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();
        const guildCheck = await Guild.findOne({ where: { guildID: interaction.guild.id } });
        if (!await validateFeature(interaction, guildCheck.version, 'hasArena')) {
            return;
        }

        switch (subCommand) {
            case 'start':
                try {
                    const modeNames = {
                        classic: 'Battle Royale: Classic',
                        evolving: 'Battle Royale: Evolving Classic',
                        'evolving-deathmatch': 'Battle Royale: Evolving Deathmatch',
                        deathmatch: 'Battle Royale: Deathmatch',
                    };
                    const mode = interaction.options.getString('mode') || 'classic';
                    const timer = interaction.options.getString('timer') || '2';
                    const timerMilliseconds = parseInt(timer) * 60 * 1000;

                    const baseStats = {
                        level: 1,
                        totalHealth: 2000,
                        totalAttack: 500,
                        totalDefense: 500
                    };

                    const embed1 = new EmbedBuilder()
                        .setColor(0xcd7f32)
                        .setTitle('THE ARENA GATES ARE OPEN!')
                        .setDescription(`**${modeNames[mode]}**\n\nThe crowd is roaring! React with ⚖️ to join the fray and prove your might!\n\nStarting in ${timer} minutes!`);

                    const message = await interaction.reply({ embeds: [embed1], fetchReply: true });
                    await message.react('⚖️');

                    const players = await Player.findAll({ where: { guildID: interaction.guild.id } });
                    let playerObjects = players.map(player => ({
                        discordID: player.discordID,
                        playerName: player.playerName,
                        level: player.level,
                        totalHealth: player.totalHealth,
                        totalAttack: player.totalAttack,
                        totalDefense: player.totalDefense,
                        respawns: 0
                    }));

                    switch (mode) {
                        case 'classic':
                            playerObjects = playerObjects.map(player => ({
                                discordID: player.discordID,
                                playerName: player.playerName,
                                level: baseStats.level,
                                totalHealth: baseStats.totalHealth,
                                totalAttack: baseStats.totalAttack,
                                totalDefense: baseStats.totalDefense
                            }));
                            break;
                        case 'evolving':
                            playerObjects = playerObjects.map(player => ({
                                discordID: player.discordID,
                                playerName: player.playerName,
                                level: baseStats.level,
                                totalHealth: baseStats.totalHealth,
                                totalAttack: baseStats.totalAttack,
                                totalDefense: baseStats.totalDefense,
                                respawns: 3
                            }));
                            break;
                        case 'deathmatch':
                            break;
                        case 'evolving-deathmatch':
                            playerObjects = playerObjects.map(player => ({
                                ...player,
                                respawns: 1
                            }));
                            break;
                    }

                    let collectedPlayers = [];
                    const filter = (reaction, user) => {
                        return playerObjects.some(player => player.discordID === user.id);
                    };

                    const collector = message.createReactionCollector({ filter, time: timerMilliseconds });

                    collector.on('collect', (reaction, user) => {
                        if (collectedPlayers.some(collectedPlayer => collectedPlayer.id === user.id)) {
                            console.log(`User ${user.id} has already joined the game.`);
                            return;
                        }

                        const player = playerObjects.find(player => player.discordID === user.id);
                        if (!player) {
                            console.log(`User ${user.id} is not in the playerObjects.`);
                            return;
                        }

                        collectedPlayers.push({ user, ...player });
                        console.log(`User ${user.id} (${player.playerName}) has joined the game.`);
                    });

                    const reminder1 = setTimeout(() => {
                        const embed = new EmbedBuilder()
                            .setColor(0xcd7f32)
                            .setDescription(`Hurry up, voyagers! Only ${(timerMilliseconds / 1000) / 2} seconds left to join the battle!`);
                        interaction.channel.send({ embeds: [embed] });
                    }, timerMilliseconds / 2);

                    const reminder2 = setTimeout(() => {
                        const embed = new EmbedBuilder()
                            .setColor(0xcd7f32)
                            .setDescription(`Last chance, voyagers! You have ${(timerMilliseconds / 1000) / 4} seconds to step into the arena!`);
                        interaction.channel.send({ embeds: [embed] });
                    }, (timerMilliseconds / 4) * 3);

                    collector.on('end', collected => {
                        clearTimeout(reminder1);
                        clearTimeout(reminder2);

                        const embed0 = new EmbedBuilder()
                            .setColor(0xcd7f32)
                            .setDescription(`Looks like no one wanted to join. Closing...`);
                        if (collectedPlayers.length === 0) return interaction.channel.send({ embeds: [embed0] });

                        const embed1 = new EmbedBuilder()
                            .setColor(0xcd7f32)
                            .setDescription(`Looks like no one wanted to accept ${collectedPlayers[0].playerName}'s challenge.`);
                        if (collectedPlayers.length < 2) return interaction.channel.send({ embeds: [embed1] });

                        const embed2 = new EmbedBuilder()
                            .setColor(0xcd7f32)
                            .setDescription('Participants have gathered. Get ready to clash in the arena!\n\nYou have 10 seconds to prepare! Who will be the last one standing?');
                        interaction.channel.send({ embeds: [embed2] });
                        arenaBattle(interaction, collectedPlayers);
                    });
                } catch (error) {
                    console.log(error);
                }
                break;

            case 'rules':
                const basicRules = `**Game Rules:**\n1. React with ⚖️ to join the event and become a contender in the arena.\n2. After gathering participants, a 10-second preparation phase will occur before the duels begin.\n3. Participants will engage in duels until only one player remains.\n4. The player with higher attack damage (without critical hits) wins the duel.\n5. The player who loses a duel is eliminated from the event.`;

                const bossRules = `\n6. After determining the final winner, a boss monster appears for an epic battle.\n7. Achievements may be awarded based on performance during the event.\n8. Participants are expected to adhere to fair play and good sportsmanship.\n9. The ultimate champion is the player who emerges as the last one standing after defeating both the contenders and the boss.`;

                const embedDescription = guildCheck.arenaBoss ? basicRules + bossRules : basicRules;

                const embedMessage = new EmbedBuilder()
                    .setColor(0xcd7f32)
                    .setDescription(embedDescription)
                    .setFooter(footer);

                await interaction.reply({ embeds: [embedMessage] });
                break;

            case 'boss':
                try {
                    const show = interaction.options.getBoolean('show');
                    if (show) {
                        guildCheck.arenaBoss = true;
                        await interaction.reply({ content: `Arena Boss is turned ON`, ephemeral: true });
                    }
                    else {
                        guildCheck.arenaBoss = false;
                        await interaction.reply({ content: `Arena Boss is turned OFF`, ephemeral: true });
                    }
                    return guildCheck.save();
                } catch (error) {
                    console.error(error);
                }
                break;
        }
    },
};