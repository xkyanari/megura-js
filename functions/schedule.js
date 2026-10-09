const parser = require('cron-parser');
const ms = require('ms');
const { EmbedBuilder, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, ChannelType, channelMention } = require('discord.js');
const { ScheduledPost } = require('../src/db');
const sendLogs = require('./logs');

/**
 * Scheduling: auto messages that Dahlia posts on a cron schedule or every N
 * minutes (Bull repeatable jobs, re-registered from the ScheduledPost table at
 * startup), and native Discord scheduled events.
 */

const MIN_INTERVAL_MINUTES = 10;
const MAX_INTERVAL_MINUTES = 30 * 24 * 60;
const MAX_POSTS_PER_GUILD = 25;

const jobIdFor = (postId) => `post-${postId}`;

const isValidTimezone = (tz) => {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: tz });
		return true;
	}
	catch {
		return false;
	}
};

/**
 * Checks a 5-field cron expression. Returns { ok: true, next } with the next
 * run as a Date, or { ok: false, reason }.
 */
const checkCron = (expression, tz = 'UTC', now = new Date()) => {
	if (expression.trim().split(/\s+/).length !== 5) {
		return { ok: false, reason: 'Use 5 fields: minute hour day-of-month month day-of-week, e.g. `0 9 * * 1` for Mondays at 9:00.' };
	}
	let interval;
	try {
		interval = parser.parseExpression(expression, { tz, currentDate: now });
	}
	catch {
		return { ok: false, reason: 'That isn\'t a valid cron expression. For example, `0 9 * * 1` is Mondays at 9:00.' };
	}

	const runs = [];
	try {
		for (let i = 0; i < 6; i++) runs.push(interval.next().getTime());
	}
	catch {
		// fewer than 6 future runs (e.g. 30 February never comes)
	}
	if (!runs.length) {
		return { ok: false, reason: 'That schedule never runs.' };
	}
	const shortest = Math.min(...runs.slice(1).map((time, i) => time - runs[i]));
	if (shortest < MIN_INTERVAL_MINUTES * 60 * 1000) {
		return { ok: false, reason: `Posts can be at most once every ${MIN_INTERVAL_MINUTES} minutes.` };
	}
	return { ok: true, next: new Date(runs[0]) };
};

// Parses "2h", "1d", "90m"... into whole minutes. Returns { ok, minutes } or { ok: false, reason }.
const parseEvery = (input) => {
	const duration = ms(input.trim());
	if (!Number.isFinite(duration)) {
		return { ok: false, reason: 'Give an interval like `30m`, `6h` or `1d`.' };
	}
	const minutes = Math.round(duration / 60000);
	if (minutes < MIN_INTERVAL_MINUTES || minutes > MAX_INTERVAL_MINUTES) {
		return { ok: false, reason: `The interval must be between ${MIN_INTERVAL_MINUTES} minutes and 30 days.` };
	}
	return { ok: true, minutes };
};

const repeatFor = (post) => (post.cron
	? { cron: post.cron, tz: post.timezone || 'UTC' }
	: { every: post.intervalMinutes * 60 * 1000 });

const describeSchedule = (post) => (post.cron
	? `\`${post.cron}\` (${post.timezone || 'UTC'})`
	: `every ${ms(post.intervalMinutes * 60 * 1000, { long: true })}`);

// Adds the post's repeatable job. Bull ignores one it already has.
const registerPost = (queue, post) => queue.add(
	{ postId: post.id },
	{ jobId: jobIdFor(post.id), repeat: repeatFor(post), removeOnComplete: true, removeOnFail: true },
);

const unregisterPost = async (queue, postId) => {
	const repeatables = await queue.getRepeatableJobs();
	await Promise.all(repeatables
		.filter((job) => job.id === jobIdFor(postId))
		.map((job) => queue.removeRepeatableByKey(job.key)));
};

// When each post next runs, by post ID.
const nextRuns = async (queue) => {
	const repeatables = await queue.getRepeatableJobs();
	return new Map(repeatables
		.filter((job) => job.id?.startsWith('post-'))
		.map((job) => [Number(job.id.slice(5)), job.next]));
};

// Makes the queue match the table: every enabled post registered, nothing else.
const syncScheduledPosts = async (queue) => {
	const posts = await ScheduledPost.findAll({ where: { enabled: true } });
	const wanted = new Set(posts.map((post) => jobIdFor(post.id)));

	for (const job of await queue.getRepeatableJobs()) {
		if (job.id?.startsWith('post-') && !wanted.has(job.id)) {
			await queue.removeRepeatableByKey(job.key);
		}
	}
	for (const post of posts) {
		await registerPost(queue, post).catch((error) => console.error(`Could not schedule post ${post.id}:`, error));
	}
	return posts.length;
};

// Runs a job queued on client.scheduleQueue (see events/ClientReady.js).
const processScheduledPost = async (client, queue, { postId }) => {
	const post = await ScheduledPost.findByPk(postId);
	if (!post || !post.enabled) {
		await unregisterPost(queue, postId);
		return false;
	}

	const channel = await client.channels.fetch(post.channelID).catch(() => null);
	if (!channel) {
		// the channel was deleted: stop, and tell the admins why
		await post.update({ enabled: false });
		await unregisterPost(queue, post.id);
		const embed = new EmbedBuilder()
			.setTitle('Scheduled post paused')
			.setColor('Orange')
			.setDescription(`Scheduled post #${post.id} was paused because its channel (${channelMention(post.channelID)}) no longer exists.`);
		await sendLogs(client, post.guildID, embed, `Scheduled post #${post.id} paused: channel ${post.channelID} no longer exists`);
		return false;
	}

	await channel.send({ content: post.content });
	await post.update({ lastPostedAt: new Date() });
	return true;
};

// --- Discord scheduled events ---------------------------------------------

// The UTC time at which the wall clock in `tz` reads the given date and time.
const zonedTimeToUtc = (year, month, day, hour, minute, tz) => {
	const asUtc = Date.UTC(year, month - 1, day, hour, minute);
	const offsetAt = (time) => {
		const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
			timeZone: tz, hourCycle: 'h23',
			year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
		}).formatToParts(new Date(time)).map((p) => [p.type, p.value]));
		return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - time;
	};
	// twice, so a guess on the far side of a daylight-saving change settles
	const first = asUtc - offsetAt(asUtc);
	return new Date(asUtc - offsetAt(first));
};

/**
 * Parses an event time: "2026-10-20 18:30" in `tz`, or a delay from now
 * like "2h". Returns a Date, or null.
 */
const parseWhen = (input, tz = 'UTC', now = Date.now()) => {
	const text = input.trim();
	const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
	if (match) {
		const [year, month, day, hour, minute] = match.slice(1).map(Number);
		if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
		return zonedTimeToUtc(year, month, day, hour, minute, tz);
	}
	const delay = ms(text);
	return Number.isFinite(delay) && delay > 0 ? new Date(now + delay) : null;
};

const ENTITY_TYPES = {
	[ChannelType.GuildVoice]: GuildScheduledEventEntityType.Voice,
	[ChannelType.GuildStageVoice]: GuildScheduledEventEntityType.StageInstance,
};

// The options for guild.scheduledEvents.create: in a voice/stage channel, or somewhere else (location).
const eventOptions = ({ name, description, start, end, channel, location }) => {
	const options = {
		name,
		description: description ?? undefined,
		scheduledStartTime: start,
		scheduledEndTime: end ?? undefined,
		privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
	};
	if (channel) {
		return { ...options, entityType: ENTITY_TYPES[channel.type], channel: channel.id };
	}
	return {
		...options,
		entityType: GuildScheduledEventEntityType.External,
		// external events need an end; default to an hour
		scheduledEndTime: end ?? new Date(start.getTime() + 60 * 60 * 1000),
		entityMetadata: { location },
	};
};

module.exports = {
	MIN_INTERVAL_MINUTES,
	MAX_POSTS_PER_GUILD,
	isValidTimezone,
	checkCron,
	parseEvery,
	describeSchedule,
	registerPost,
	unregisterPost,
	nextRuns,
	syncScheduledPosts,
	processScheduledPost,
	zonedTimeToUtc,
	parseWhen,
	eventOptions,
};
