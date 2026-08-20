const fs = require('fs');
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

const writeLogs = async (guildId, logEntry) => {
	try {
		const date = new Date().toISOString().split('T')[0];
		const resolvedLogDir = getResolvedLogDir();
		const logFile = path.join(resolvedLogDir, `guildID${guildId}_${date}.log`);

		if (!fs.existsSync(resolvedLogDir)) {
			fs.mkdirSync(resolvedLogDir);
		}

		fs.appendFile(logFile, `${logEntry}\n`, (err) => {
			if (err) {
				console.error(`Failed to write log entry to file: ${err}`);
			}
			else {
				console.log('Log entry written to file successfully.');
			}
		});
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = async (client, guildId, embed, logEntry) => {
	try {
		const data = await Guild.findOne({ where: { guildID: guildId } });
		if (!data || !data.logsChannelID) return;

		const channel = client.channels.cache.get(data.logsChannelID);

		if (!channel) return;
		embed.setTimestamp();
		const sentAt = new Date();
		await channel.send({ embeds: [embed] });
		writeLogs(guildId, `<${sentAt.toISOString()}> : ${logEntry}`);
	}
	catch (error) {
		console.error(error);
	}
};

module.exports.cleanupOldLogs = cleanupOldLogs;
