const fs = require('fs');
const { EmbedBuilder, userMention } = require('discord.js');
const path = require('path');
const { logDir } = require('../src/vars');
const { Guild } = require('../src/db');

const LOG_RETENTION_DAYS = 30;
const LOG_RETENTION_MS = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const getResolvedLogDir = () => path.resolve(__dirname, logDir);

const cleanupOldLogs = async () => {
	try {
		const resolvedLogDir = getResolvedLogDir();
		if (!fs.existsSync(resolvedLogDir)) return;

		const cutoff = Date.now() - LOG_RETENTION_MS;
		const files = await fs.promises.readdir(resolvedLogDir);

		const results = await Promise.allSettled(files.map(async (file) => {
			const logFile = path.join(resolvedLogDir, file);
			const stats = await fs.promises.stat(logFile);

			if (stats.isFile() && stats.mtimeMs < cutoff) {
				await fs.promises.unlink(logFile);
			}
		}));

		results.forEach((result) => {
			if (result.status === 'rejected' && result.reason?.code !== 'ENOENT') {
				console.error(result.reason);
			}
		});
	}
	catch (error) {
		console.error(error);
	}
};

const logFilePrefix = (guildId) => `guildID${guildId}_`;

// Appends one line to the server's log file for today (logs/guildID<id>_<date>.log).
const writeLogs = async (guildId, logEntry) => {
	try {
		const date = new Date().toISOString().split('T')[0];
		const resolvedLogDir = getResolvedLogDir();
		await fs.promises.mkdir(resolvedLogDir, { recursive: true });
		await fs.promises.appendFile(path.join(resolvedLogDir, `${logFilePrefix(guildId)}${date}.log`), `${logEntry}\n`);
	}
	catch (error) {
		console.error(`Failed to write log entry to file: ${error}`);
	}
};

// Returns the server's most recent log entries, newest first.
// Entries are kept for LOG_RETENTION_DAYS (see cleanupOldLogs).
const readRecentLogs = async (guildId, count) => {
	const resolvedLogDir = getResolvedLogDir();
	let files;
	try {
		files = await fs.promises.readdir(resolvedLogDir);
	}
	catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}

	// file names end in YYYY-MM-DD, so a reverse sort is newest first
	const guildFiles = files
		.filter((file) => file.startsWith(logFilePrefix(guildId)) && file.endsWith('.log'))
		.sort()
		.reverse();

	const entries = [];
	for (const file of guildFiles) {
		const content = await fs.promises.readFile(path.join(resolvedLogDir, file), 'utf8');
		entries.push(...content.split('\n').filter(Boolean).reverse());
		if (entries.length >= count) break;
	}
	return entries.slice(0, count);
};

// Records an event in the server's log history, and posts it to the
// /setup logs channel when one is set.
const sendLogs = async (client, guildId, embed, logEntry) => {
	const sentAt = new Date();
	await writeLogs(guildId, `<${sentAt.toISOString()}> : ${logEntry}`);

	try {
		const data = await Guild.findOne({ where: { guildID: guildId } });
		if (!data || !data.logsChannelID) return;

		const channel = client.channels.cache.get(data.logsChannelID)
			?? await client.channels.fetch(data.logsChannelID).catch(() => null);
		if (!channel) return;

		embed.setTimestamp(sentAt);
		await channel.send({ embeds: [embed] });
	}
	catch (error) {
		console.error(error);
	}
};

/**
 * Logs a /setup change: who made it, what changed and the new values.
 * `changes` is a list of { name, value, text }: `value` is shown in the logs
 * channel embed (mentions are fine), `text` is written to the log file.
 */
const logSetupChange = (interaction, action, changes = []) => {
	const { user } = interaction;
	const embed = new EmbedBuilder()
		.setTitle(`Setup: ${action}`)
		.setColor('Blue')
		.setDescription(`Changed by ${userMention(user.id)}`);
	if (changes.length) {
		embed.addFields(changes.map(({ name, value }) => ({ name, value: String(value), inline: true })));
	}

	const summary = changes.map(({ name, text, value }) => `${name}: ${text ?? value}`).join(', ');
	const logEntry = `${user.tag ?? user.username} (${user.id}) ${action}${summary ? ` [${summary}]` : ''}`;

	return sendLogs(interaction.client, interaction.guild.id, embed, logEntry);
};

module.exports = sendLogs;
module.exports.cleanupOldLogs = cleanupOldLogs;
module.exports.readRecentLogs = readRecentLogs;
module.exports.logSetupChange = logSetupChange;
