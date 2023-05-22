const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const buttonPages = require('../../functions/paginator');

const getTopPlayers = async (attribute, guildID) => {
    return await Player.findAll({
        order: [[attribute, 'DESC']],
        limit: 10,
        where: {
            guildID
        }
    });
};

const generateTopPlayersEmbed = async (attribute, title, valueFormatter, guildID) => {
    const topPlayers = await getTopPlayers(attribute, guildID);
    const playerList = topPlayers.map((player, i) => `${i + 1}. **${player.playerName}** - ${valueFormatter(player)}\n`);

    return new EmbedBuilder()
        .setColor(0xCD7F32)
        .setTitle(title)
        .setDescription(`${playerList.join('')}
        **Messinia Graciene: Project DAHLIA**
        [Invite Me](https://discord.com/api/oauth2/authorize?client_id=1108464420465692795&permissions=139855260823&scope=bot)🔸[Docs](https://docs.megura.xyz)🔸[Support Server](https://discord.gg/X9eEW6yuhq)🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)
        `);
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rankings')
		.setDescription('Check the leaderboard (server-wide).'),
    cooldown: 3000,
	async execute(interaction) {
        await interaction.deferReply();

        const duels = await generateTopPlayersEmbed('duelkills', 'Top 10 Duel Wins:', player => `${player.duelKills} Wins`, interaction.guild.id);
        const levels = await generateTopPlayersEmbed('level', 'Top 10 Highest Levels:', player => `Level ${player.level}`, interaction.guild.id);

        const monsters = await generateTopPlayersEmbed('monsterKills', 'Top 10 Monster Kills:', player => `${player.monsterKills} Kills`, interaction.guild.id);

        const iuras = await generateTopPlayersEmbed('iuraEarned', 'Top 10 Richest Voyagers:', player => `${player.iuraEarned} IURA`, interaction.guild.id);

        const embedPages = [duels, levels, monsters, iuras];

		buttonPages(interaction, embedPages);
    }
};