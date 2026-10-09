const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const buttonPages = require('../../functions/paginator');
const R = require('../../functions/rankings');

const numFormat = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);

const board = (title, rows, unit) => {
	const list = rows.length
		? rows.map((row, i) => `${i + 1}. **${row.playerName}** - ${unit(row.value)}`).join('\n')
		: 'Nobody yet.';
	return new EmbedBuilder().setColor(0xcd7f32).setTitle(title)
		.setDescription(`${list}

            **Messinia Graciene: Project DAHLIA**
            [Invite Me](https://discord.com/api/oauth2/authorize?client_id=1108464420465692795&permissions=139855260823&scope=bot)🔸[Docs](https://docs.megura.xyz)🔸[Support Server](https://discord.gg/X9eEW6yuhq)🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)
            `);
};

// The leaderboard pages, in order: [EmbedBuilder].
const rankingPages = async (guildID, now = Date.now()) => {
	const [duels, levels, monsters, earners, quests, places, factions] = await Promise.all([
		R.topBy(guildID, 'duelKills'),
		R.topBy(guildID, 'level'),
		R.topBy(guildID, 'monsterKills'),
		R.topBy(guildID, 'iuraEarned'),
		R.topQuestsThisWeek(guildID, now),
		R.topDiscoveries(guildID),
		R.topFactionScorers(guildID, now),
	]);
	return [
		board('Top 10 Duel Wins:', duels, (n) => `${n} Wins`),
		board('Top 10 Highest Levels:', levels, (n) => `Level ${n}`),
		board('Top 10 Monster Kills:', monsters, (n) => `${n} Kills`),
		board('Top 10 Earners (lifetime IURA):', earners, (n) => `${numFormat(n)} IURA`),
		board('Top 10 Quest Finishers This Week:', quests, (n) => `${n} quest(s)`),
		board('Top 10 Explorers:', places, (n) => `${n} place(s) discovered`),
		board('Top 10 Faction Scorers This Week:', factions, (n) => `${n} point(s)`),
	];
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('rankings')
		.setDescription('Check the leaderboard (server-wide).'),
	cooldown: 3000,
	rankingPages,
	async execute(interaction) {
		await interaction.deferReply();
		await buttonPages(interaction, await rankingPages(interaction.guild.id));
	},
};
