const { SlashCommandBuilder, ChannelType, EmbedBuilder, PermissionFlagsBits, channelMention } = require('discord.js');
const { Guild, ScheduledPost } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { logSetupChange } = require('../../functions/logs');
const {
	MAX_POSTS_PER_GUILD,
	isValidTimezone,
	checkCron,
	parseEvery,
	describeSchedule,
	registerPost,
	unregisterPost,
	nextRuns,
	parseWhen,
	eventOptions,
} = require('../../functions/schedule');

const timezoneOption = (option) => option
	.setName('timezone')
	.setDescription('IANA time zone, e.g. Asia/Manila or America/New_York (default: UTC).')
	.setMaxLength(64);

const ephemeral = (interaction, content) => interaction.reply({ content, flags: 64 });

const timestamp = (date) => `<t:${Math.floor(new Date(date).getTime() / 1000)}:f>`;

const preview = (content) => (content.length > 80 ? `${content.slice(0, 77)}...` : content).replace(/\n/g, ' ');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('schedule')
		.setDescription('Scheduled posts and server events.')
		.addSubcommandGroup((group) =>
			group
				.setName('post')
				.setDescription('Messages Dahlia posts on a schedule.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Post a message on a schedule. Give either cron or every.')
						.addChannelOption((option) =>
							option.setName('channel').setDescription('Where to post.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true),
						)
						.addStringOption((option) =>
							option.setName('message').setDescription('What to post (up to 2000 characters).').setMaxLength(2000).setRequired(true),
						)
						.addStringOption((option) =>
							option.setName('every').setDescription('Repeat interval, e.g. 30m, 6h, 1d (at least 10 minutes).').setMaxLength(20),
						)
						.addStringOption((option) =>
							option.setName('cron').setDescription('Cron schedule, e.g. "0 9 * * 1" for Mondays at 9:00.').setMaxLength(100),
						)
						.addStringOption(timezoneOption),
				)
				.addSubcommand((subcommand) =>
					subcommand.setName('list').setDescription('Show this server\'s scheduled posts.'),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Stop and delete a scheduled post.')
						.addIntegerOption((option) =>
							option.setName('id').setDescription('Post ID (see /schedule post list).').setMinValue(1).setRequired(true),
						),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('event')
				.setDescription('Discord server events.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('create')
						.setDescription('Create a server event. Give a voice/stage channel or a location.')
						.addStringOption((option) =>
							option.setName('name').setDescription('Event name.').setMaxLength(100).setRequired(true),
						)
						.addStringOption((option) =>
							option.setName('start').setDescription('"2026-10-20 18:30" (in the time zone below), or a delay like 2h.').setRequired(true),
						)
						.addStringOption((option) =>
							option.setName('end').setDescription('End time, same format (default: an hour after the start for locations).'),
						)
						.addChannelOption((option) =>
							option.setName('channel').setDescription('Voice or stage channel it happens in.').addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice),
						)
						.addStringOption((option) =>
							option.setName('location').setDescription('Where it happens, if not in a channel (a place or a link).').setMaxLength(100),
						)
						.addStringOption((option) =>
							option.setName('description').setDescription('What the event is about.').setMaxLength(1000),
						)
						.addStringOption(timezoneOption),
				),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { options, guild, client } = interaction;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasScheduling')) {
			return;
		}

		const group = options.getSubcommandGroup();
		const subcommand = options.getSubcommand();
		const timezone = options.getString('timezone')?.trim() || 'UTC';
		if (!isValidTimezone(timezone)) {
			return ephemeral(interaction, `\`${timezone}\` isn't a time zone I know. Use a name like \`Asia/Manila\`, \`Europe/London\` or \`America/New_York\`.`);
		}

		if (group === 'post' && subcommand === 'add') {
			const channel = options.getChannel('channel');
			const cron = options.getString('cron')?.trim();
			const every = options.getString('every')?.trim();
			if (Boolean(cron) === Boolean(every)) {
				return ephemeral(interaction, 'Give either `every` (like `6h`) or `cron` (like `0 9 * * 1`), not both.');
			}
			if (!channel.permissionsFor(guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
				return ephemeral(interaction, `I can't post in ${channelMention(channel.id)}. I need **View Channel** and **Send Messages** there.`);
			}
			if (await ScheduledPost.count({ where: { guildID: guild.id } }) >= MAX_POSTS_PER_GUILD) {
				return ephemeral(interaction, `A server can have up to ${MAX_POSTS_PER_GUILD} scheduled posts. Remove one with \`/schedule post remove\` first.`);
			}

			const fields = { guildID: guild.id, channelID: channel.id, content: options.getString('message'), createdBy: interaction.user.id };
			if (cron) {
				const check = checkCron(cron, timezone);
				if (!check.ok) return ephemeral(interaction, check.reason);
				Object.assign(fields, { cron, timezone });
			}
			else {
				const parsed = parseEvery(every);
				if (!parsed.ok) return ephemeral(interaction, parsed.reason);
				fields.intervalMinutes = parsed.minutes;
			}

			const post = await ScheduledPost.create(fields);
			try {
				await registerPost(client.scheduleQueue, post);
			}
			catch (error) {
				await post.destroy();
				throw error;
			}

			const next = (await nextRuns(client.scheduleQueue)).get(post.id);
			await ephemeral(interaction, `Scheduled post **#${post.id}** will be posted in ${channelMention(channel.id)} ${describeSchedule(post)}.${next ? ` First post: ${timestamp(next)}.` : ''}`);
			await logSetupChange(interaction, 'scheduled a post', [
				{ name: 'ID', value: post.id },
				{ name: 'Channel', value: channelMention(channel.id), text: `#${channel.name}` },
				{ name: 'Schedule', value: describeSchedule(post) },
			]);
			return;
		}

		if (group === 'post' && subcommand === 'list') {
			const posts = await ScheduledPost.findAll({ where: { guildID: guild.id }, order: [['id', 'ASC']] });
			const next = await nextRuns(client.scheduleQueue);
			const lines = posts.map((post) => {
				const when = post.enabled
					? (next.get(post.id) ? `next ${timestamp(next.get(post.id))}` : 'not scheduled')
					: 'paused (channel deleted)';
				return `**#${post.id}** in ${channelMention(post.channelID)} ${describeSchedule(post)}, ${when}\n> ${preview(post.content)}`;
			});
			const embed = new EmbedBuilder()
				.setTitle('Scheduled posts')
				.setColor(0xcd7f32)
				.setDescription(lines.length ? lines.join('\n') : 'No scheduled posts. Add one with `/schedule post add`.');
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		if (group === 'post' && subcommand === 'remove') {
			const id = options.getInteger('id');
			const post = await ScheduledPost.findOne({ where: { id, guildID: guild.id } });
			if (!post) {
				return ephemeral(interaction, `There's no scheduled post #${id} in this server.`);
			}
			await unregisterPost(client.scheduleQueue, post.id);
			await post.destroy();
			await ephemeral(interaction, `Removed scheduled post #${id}.`);
			await logSetupChange(interaction, 'removed a scheduled post', [{ name: 'ID', value: id }]);
			return;
		}

		if (group === 'event' && subcommand === 'create') {
			if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageEvents)) {
				return ephemeral(interaction, 'I need the **Manage Events** permission to create events.');
			}
			const channel = options.getChannel('channel');
			const location = options.getString('location')?.trim();
			if (Boolean(channel) === Boolean(location)) {
				return ephemeral(interaction, 'Give either a voice/stage `channel` or a `location`, not both.');
			}

			const start = parseWhen(options.getString('start'), timezone);
			const endInput = options.getString('end');
			const end = endInput ? parseWhen(endInput, timezone) : null;
			if (!start || (endInput && !end)) {
				return ephemeral(interaction, 'Give times like `2026-10-20 18:30` (in the `timezone` you choose, UTC by default) or a delay like `2h`.');
			}
			if (start <= new Date()) {
				return ephemeral(interaction, 'The event must start in the future.');
			}
			if (end && end <= start) {
				return ephemeral(interaction, 'The event must end after it starts.');
			}

			await interaction.deferReply({ flags: 64 });
			const event = await guild.scheduledEvents.create(eventOptions({
				name: options.getString('name'),
				description: options.getString('description'),
				start,
				end,
				channel,
				location,
			}));
			await interaction.editReply(`Created the event **${event.name}**, starting ${timestamp(start)}.${event.url ? `\n${event.url}` : ''}`);
			await logSetupChange(interaction, 'created a server event', [
				{ name: 'Name', value: event.name },
				{ name: 'Starts', value: timestamp(start), text: start.toISOString() },
			]);
		}
	},
};
