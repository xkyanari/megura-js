const fs = require('fs');
const path = require('path');
const { logDir } = require('../src/vars');
const { Guild } = require('../src/db');

const writeLogs = async (guildId, logEntry) => {
	try {
		const date = new Date().toISOString().split('T')[0];
		const resolvedLogDir = path.resolve(__dirname, logDir);
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
