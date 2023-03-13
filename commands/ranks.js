const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ranks')
		.setDescription('Check the leaderboard.'),
    cooldown: 3000,
	async execute(interaction) {

        const allPlayers = await Player.findAll({
            order: [['monsterKills', 'DESC']], 
            limit: 10
        });

        let playerRanks = [];
        allPlayers.forEach(player => {
            let i = 1;
            playerRanks.push(`${i}. **${player.playerName}** - ${player.monsterKills} Wins\n`);
            i++;
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Top 10 Duel Wins:')
            .setDescription(playerRanks.join(''));

		await interaction.reply({ embeds: [embed] });
    }
};