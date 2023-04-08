const { SlashCommandBuilder } = require('discord.js');
const { Player, Monster, Iura, sequelize } = require('../src/db');
const { simulateBattle } = require('../functions/battle');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('attack')
		.setDescription('Attack a random monster'),
    cooldown: 25000,
	async execute(interaction) {
        const wait = require('node:timers/promises').setTimeout;
        const { member, guild } = interaction;

        await interaction.deferReply();
        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.editReply("You do not have a player profile in this world yet.");

            try {
                const levelCheck = player.totalAttack < 2500 ? 1 : 2;

                const [ monster ] = await Monster.findAll({ order: sequelize.random(), limit: 1, where: { level: levelCheck } });

                const playerObj = {
                    playerName: player.playerName,
                    level: player.level,
                    totalHealth: player.totalHealth,
                    totalAttack: player.totalAttack,
                    totalDefense: player.totalDefense
                };

                const monsterObj = {
                    playerName: monster.monsterName,
                    level: monster.level,
                    totalHealth: monster.totalHealth,
                    totalAttack: monster.totalAttack,
                    totalDefense: monster.totalDefense
                };

                await interaction.editReply("Searching for a monster...");
                await wait(1000);
                await interaction.channel.send("Target locked. Engaging in 5 seconds...");
                await wait(5000);
                await simulateBattle(interaction, playerObj, monsterObj);
                
            } catch (error) {
                console.log(error);
            }
	}
};