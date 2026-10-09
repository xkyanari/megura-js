const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, channelMention, roleMention } = require('discord.js');
const { Player, Guild, FactionConfig } = require('../../src/db');
const { footer } = require('../../src/vars');
const { FACTIONS, RIVAL_DAMAGE_BONUS, syncFaction, factionLabel, pointsThisWeek, standings } = require('../../functions/factions');
const { lastSeason } = require('../../functions/factionSeason');
const chooseFaction = require('../../functions/faction');
const { nextWeekStart } = require('../../functions/period');

const table = (scores, guild) => {
	const [leader] = [...FACTIONS].sort((a, b) => scores[b] - scores[a]);
	const tied = FACTIONS.every((faction) => scores[faction] === scores[leader]);
	return FACTIONS
		.map((faction) => `${!tied && faction === leader ? '👑' : '▫️'} **${factionLabel(faction, guild)}**: ${scores[faction]}`)
		.join('\n');
};

const showStandings = async (interaction) => {
	const { member, guild } = interaction;
	const guildRow = await Guild.findOne({ where: { guildID: guild.id } });
	const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
	const faction = player && await syncFaction(player, guildRow, member);
	const { thisWeek, lastWeek } = await standings(guild.id);
	const season = await lastSeason(guild.id);

	const yours = faction
		? `You fight for **${factionLabel(faction, guildRow)}**: you deal +${RIVAL_DAMAGE_BONUS * 100}% damage to the rival faction's monsters, and each one you defeat scores a point. You have scored **${await pointsThisWeek(guild.id, player.accountID)}** this week.`
		: 'You haven\'t joined a faction yet: pick one with `/factions join`. Members deal more damage to the rival faction\'s monsters and score points for their side.';
	const lastResult = season
		? (season.winner ? `👑 **${factionLabel(season.winner, guildRow)}** won, and ${season.rewardedIDs.length} member(s) were rewarded.` : 'No winner.')
		: 'No season has ended yet.';

	const embed = new EmbedBuilder()
		.setColor(0xcd7f32)
		.setTitle('⚔️ FACTION STANDINGS')
		.setDescription(yours)
		.addFields(
			{ name: `This week (ends <t:${Math.floor(nextWeekStart() / 1000)}:R>)`, value: table(thisWeek, guildRow) },
			{ name: 'Last week', value: table(lastWeek, guildRow) },
			{ name: 'Last season', value: lastResult },
		)
		.setFooter({ ...footer, text: `Each week, the winning faction's scorers are paid IURA. ${footer.text}` });
	await interaction.reply({ embeds: [embed] });
};

const setup = async (interaction) => {
	if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
		return interaction.reply({ content: 'You need the Moderate Members permission to do that.', flags: 64 });
	}
	const channel = interaction.options.getChannel('channel');
	const role = interaction.options.getRole('role');
	if (role?.managed || role?.id === interaction.guild.id) {
		return interaction.reply({ content: 'That role can\'t be given out. Pick a regular role.', flags: 64 });
	}
	await FactionConfig.upsert({ guildID: interaction.guild.id, channelID: channel.id, roleID: role?.id ?? null });
	return interaction.reply({
		content: `Faction season results will be posted in ${channelMention(channel.id)} every Monday (UTC).`
			+ (role ? ` The winning faction's scorers get ${roleMention(role.id)} until the next season. Dahlia needs **Manage Roles**, and her role must be above it.` : ''),
		flags: 64,
	});
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('factions')
		.setDescription('Factions: pick a side, standings and seasons.')
		.addSubcommand((subcommand) =>
			subcommand.setName('standings').setDescription('See how the factions stand this week.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('join').setDescription('Choose your faction.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setup')
				.setDescription('(Moderators) Where to announce weekly results, and a champion role.')
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to post the results.').addChannelTypes(ChannelType.GuildText).setRequired(true),
				)
				.addRoleOption((option) =>
					option.setName('role').setDescription('Given to the winning side\'s scorers for the week (optional).'),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		// shows the faction buttons (components/buttons/margaretha.js and cerberon.js)
		if (subcommand === 'join') return chooseFaction(interaction);
		if (subcommand === 'setup') return setup(interaction);
		return showStandings(interaction);
	},
};
