const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require('discord.js');
const { Player } = require('../../src/db');
const { arenaBattle } = require('../../functions/arena');
const { footer } = require('../../src/vars');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('arena')
        .setDescription('Start an arena event!')
        .setDefaultMemberPermissions('0')
        .addSubcommand((subcommand) =>
            subcommand.setName('start').setDescription('Join the event.'),
        )
        .addSubcommand((subcommand) =>
            subcommand.setName('rules').setDescription('Show the rules.'),
        ),
        // .addSubcommand((subcommand) =>
        //     subcommand
        //         .setName('difficulty')
        //         .setDescription('Select difficulty level.')
        //         .addStringOption(option =>
        //             option.setName('type')
        //                 .setDescription('Choose one.')
        //                 .setRequired(true)
        //                 .addChoices(
        //                     { name: 'Easy', value: 'easy' },
        //                     { name: 'Medium', value: 'medium' },
        //                     { name: 'Hard', value: 'hard' },
        //                     { name: 'Deathmatch', value: 'deathmatch' },
        //                 ),
        //         ),
        // ),
    cooldown: 0,
    async execute(interaction) {
        const subCommand = interaction.options.getSubcommand();
        switch (subCommand) {
            case 'start':
                const embed1 = new EmbedBuilder()
                    .setColor(0xcd7f32)
                    .setTitle('THE ARENA GATES ARE OPEN!')
                    .setDescription('The crowd is roaring! React with ⚖️ to join the fray and prove your might!\n\nStarting in 60 seconds!');

                const message = await interaction.reply({ embeds: [embed1], fetchReply: true });
                await message.react('⚖️');

                const players = await Player.findAll({ where: { guildID: interaction.guild.id }});
                const playerObjects = players.map(player => ({
                    discordID: player.discordID,
                    playerName: player.playerName,
                    level: player.level,
                    totalHealth: player.totalHealth,
                    totalAttack: player.totalAttack,
                    totalDefense: player.totalDefense,
                }));

                let collectedPlayers = [];
                const filter = (reaction, user) => {
                    return playerObjects.some(player => player.discordID === user.id);
                };

                const collector = message.createReactionCollector({ filter, time: 60000 });
                collector.on('collect', (reaction, user) => {
                    const player = playerObjects.find(player => player.discordID === user.id);
                    collectedPlayers.push({ user, playerName: player.playerName, level: player.level, totalHealth: player.totalHealth, totalAttack: player.totalAttack, totalDefense: player.totalDefense });
                });

                collector.on('end', collected => {
                    const embed1 = new EmbedBuilder()
                        .setColor(0xcd7f32)
                        .setDescription(`Looks like no one wanted to accept ${collectedPlayers[0].playerName}'s challenge.`);
                    if (collectedPlayers.length < 2) return interaction.channel.send({ embeds: [embed1] });

                    const embed2 = new EmbedBuilder()
                        .setColor(0xcd7f32)
                        .setDescription('Participants have gathered. Get ready to clash in the arena!\n\nYou have 10 seconds to prepare! Who will be the last one standing?')
                    interaction.channel.send({ embeds: [embed2] });
                    arenaBattle(interaction, collectedPlayers);
                });
                break;
            case 'rules':
                const embed2 = new EmbedBuilder()
                    .setColor(0xcd7f32)
                    .setDescription(`**Game Rules:**\n1. React with ⚖️ to join the event and become a contender in the arena.\n2. After gathering participants, a 10-second preparation phase will occur before the duels begin.\n3. Participants will engage in duels until only one player remains.\n4. The player with higher attack damage (without critical hits) wins the duel.\n5. The player who loses a duel is eliminated from the event.\n6. After determining the final winner, a boss monster appears for an epic battle.\n7. Achievements may be awarded based on performance during the event.\n8. Participants are expected to adhere to fair play and good sportsmanship.\n9. The ultimate champion is the player who emerges as the last one standing after defeating both the contenders and the boss.`)
                    .setFooter(footer);
                await interaction.reply({ embeds: [embed2] });
                break;
            // case 'difficulty':

            //     break;
        }
    },
};