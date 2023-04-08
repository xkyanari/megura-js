const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../src/db');
const { simulateBattle } = require('../functions/battle');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Request for duel')
        .addUserOption(option =>
            option
            .setName('target')
            .setDescription('Choose the player you want to fight.')
            .setRequired(true)),
    cooldown: 600000,
    async execute(interaction) {
        const wait = require('node:timers/promises').setTimeout;
        const player1 = interaction.member;
        const player2 = interaction.options.getMember('target');

        await interaction.deferReply();

        if (player1.id === player2.id) return interaction.editReply("There is a saying that goes:```“The attempt to force human beings to despise themselves is what I call hell.” ― Andre Malraux```Sorry, I cannot allow that.");
        if (interaction.client.user.id === player2.id) return interaction.editReply("I don't engage in battles.");
        if (player2.user.bot) return interaction.editReply("You cannot duel with bots.");

        try {
            const players = await Player.findAll({ 
                where: { 
                    discordID: [player1.id, player2.id],
                    guildID: interaction.guild.id 
                }, 
                include: 'iura' 
            });

            let p1Index = players.findIndex(p => p.discordID === player1.id);
            let p1;

            if (p1Index !== -1) {
            p1 = players[p1Index];
            }

            if (p1Index !== 0) {
            [players[0], players[p1Index]] = [players[p1Index], players[0]];
            p1Index = 0;
            }

            const updatedPlayer1 = players[0];
            const updatedPlayer2 = players[1];

            if (players.length === 2) {
                await interaction.editReply("The battle commences!");
                await wait(1000);
                await interaction.channel.send("Starting in 10 seconds...");
                await wait(10000);
                await simulateBattle(interaction, updatedPlayer1, updatedPlayer2);
            } else if (!updatedPlayer1) {
                await interaction.editReply(`${player1.user.tag} do not have a voyager profile yet.`);
            } else if (!updatedPlayer2) {
                await interaction.editReply(`${player2.user.tag} does not have a voyager profile yet.`);
            } else {
                await interaction.editReply(`Both players do not have voyager profiles yet.`);
            }
        } catch (error) {
            console.log(error);
        }
    }
};