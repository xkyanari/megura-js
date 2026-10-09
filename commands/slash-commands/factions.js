const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Guild } = require('../../src/db');
const { footer } = require('../../src/vars');
const { FACTIONS, RIVAL_DAMAGE_BONUS, syncFaction, factionLabel, standings } = require('../../functions/factions');
const chooseFaction = require('../../functions/faction');
const { nextWeekStart } = require('../../functions/period');

const table = (scores, guild) => {
	const [leader] = [...FACTIONS].sort((a, b) => scores[b] - scores[a]);
	const tied = FACTIONS.every((faction) => scores[faction] === scores[leader]);
	return FACTIONS
		.map((faction) => `${!tied && faction === leader ? '👑' : '▫️'} **${factionLabel(faction, guild)}**: ${scores[faction]}`)
		.join('\n');
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('factions')
		.setDescription('Factions: pick a side and see the standings.')
		.addSubcommand((subcommand) =>
			subcommand.setName('standings').setDescription('See how the factions stand this week.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('join').setDescription('Choose your faction.'),
		),
	cooldown: 3000,
	async execute(interaction) {
		// shows the faction buttons (components/buttons/margaretha.js and cerberon.js)
		if (interaction.options.getSubcommand() === 'join') return chooseFaction(interaction);

		const { member, guild } = interaction;
		const guildRow = await Guild.findOne({ where: { guildID: guild.id } });
		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		const faction = player && await syncFaction(player, guildRow, member);
		const { thisWeek, lastWeek } = await standings(guild.id);

		const yours = faction
			? `You fight for **${factionLabel(faction, guildRow)}**: you deal +${RIVAL_DAMAGE_BONUS * 100}% damage to the rival faction's monsters, and each one you defeat scores a point.`
			: 'You haven\'t joined a faction yet: pick one with `/factions join`. Members deal more damage to the rival faction\'s monsters and score points for their side.';

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('⚔️ FACTION STANDINGS')
			.setDescription(yours)
			.addFields(
				{ name: `This week (ends <t:${Math.floor(nextWeekStart() / 1000)}:R>)`, value: table(thisWeek, guildRow) },
				{ name: 'Last week', value: table(lastWeek, guildRow) },
			)
			.setFooter(footer);
		await interaction.reply({ embeds: [embed] });
	},
};
