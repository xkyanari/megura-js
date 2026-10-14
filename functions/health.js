const fs = require('node:fs');
const { Status } = require('discord.js');

/**
 * Heartbeat for the Docker HEALTHCHECK (see Dockerfile): while the bot is
 * connected to Discord, the file's modification time is kept fresh. The
 * container is "healthy" while the file is under 2 minutes old, which
 * scripts/update.sh waits for before it calls an update done.
 */

const HEALTH_FILE = process.env.HEALTH_FILE || '/tmp/megura-alive';
const INTERVAL_MS = 30 * 1000;

const beat = (client, file = HEALTH_FILE) => {
	if (client.ws.status !== Status.Ready) return false;
	try {
		fs.writeFileSync(file, `${new Date().toISOString()}\n`);
		return true;
	}
	catch (error) {
		console.error('Could not write the health file:', error);
		return false;
	}
};

// Called once ClientReady's startup work is done, so "healthy" means fully started.
const startHeartbeat = (client, file = HEALTH_FILE) => {
	beat(client, file);
	const timer = setInterval(() => beat(client, file), INTERVAL_MS);
	timer.unref();
	return timer;
};

module.exports = { beat, startHeartbeat, HEALTH_FILE };
