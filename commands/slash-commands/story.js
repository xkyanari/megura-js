const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, channelMention, time } = require('discord.js');
const { Guild } = require('../../src/db');
const { footer } = require('../../src/vars');
const { isFeatureEnabled } = require('../../src/feature');
const S = require('../../functions/story');
const { runBossFight, channelIO, hasGroupFightIn } = require('../../functions/boss');

// A [boss] line summons a world boss where the chapter is playing, if the server has bosses.
const bossFor = (guildID, channel) => async () => {
	const guild = await Guild.findOne({ where: { guildID } });
	if (!guild || !await isFeatureEnabled(guild.subscription, 'hasBosses') || hasGroupFightIn(channel.id)) return;
	// the story waits for the fight to end
	await runBossFight({ kind: 'group', guildID, channelID: channel.id, io: channelIO(channel) })
		.catch((error) => console.error(`Story boss in ${guildID} failed:`, error));
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('story')
		.setDescription('(Moderators) Tell the story of Messinia Graciene.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('play')
				.setDescription('Play a chapter, one paragraph at a time.')
				.addStringOption((option) =>
					option.setName('chapter').setDescription('Which chapter.').setRequired(true).setAutocomplete(true),
				)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to play it (default: this channel).').addChannelTypes(ChannelType.GuildText),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('See the chapters, and which ones this server has played.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('stop').setDescription('Stop the chapter playing in this channel.'),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { guild, options } = interaction;
		const subcommand = options.getSubcommand();

		if (subcommand === 'list') {
			const chapters = S.listChapters();
			const played = await S.playedIn(guild.id);
			const lines = chapters.map((chapter) => {
				const when = played.get(chapter.name);
				return when ? `✅ **${chapter.name}** (played ${time(new Date(when), 'R')})` : `▫️ ${chapter.name}`;
			});
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle('📖 CHAPTERS')
				.setDescription((lines.join('\n') || 'No chapters yet. Add them to the chapters/ folder.').slice(0, 4000))
				.setFooter(footer);
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		if (subcommand === 'stop') {
			return interaction.reply({
				content: S.stopChapter(interaction.channelId) ? 'The story stops after this paragraph.' : 'No chapter is playing in this channel.',
				flags: 64,
			});
		}

		// play
		const chapter = S.chapterNamed(options.getString('chapter'));
		if (!chapter) {
			return interaction.reply({ content: 'There is no such chapter. Pick one from the list.', flags: 64 });
		}
		const channel = options.getChannel('channel') ?? interaction.channel;
		if (S.isPlaying(channel.id)) {
			return interaction.reply({ content: `A chapter is already playing in ${channelMention(channel.id)}.`, flags: 64 });
		}

		await interaction.reply({ content: `▶️ Playing **${chapter.name}** in ${channelMention(channel.id)}. Use \`/story stop\` there to stop it.`, flags: 64 });
		// the chapter outlives this command: errors go to the log, not the (finished) reply
		S.playChapter(channel, chapter, { onBoss: bossFor(guild.id, channel) })
			.then((result) => (result === 'finished' ? S.recordPlayed(guild.id, chapter, interaction.user.id) : null))
			.catch((error) => console.error(`Playing ${chapter.name} in ${guild.id} failed:`, error));
	},
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused().toLowerCase();
		await interaction.respond(S.listChapters()
			.filter((chapter) => chapter.name.toLowerCase().includes(focused))
			.slice(0, 25)
			.map((chapter) => ({ name: chapter.name, value: chapter.name })));
	},
};
