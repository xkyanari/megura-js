const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Status } = require('discord.js');
const { beat, startHeartbeat } = require('../functions/health');

/**
 * The Docker HEALTHCHECK only passes while functions/health.js keeps its file
 * fresh, and it should only do that while the bot is connected to Discord.
 */

describe('health heartbeat', () => {
	const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'health-')), 'alive');

	test('no heartbeat while the bot isn\'t connected', () => {
		assert.equal(beat({ ws: { status: Status.Reconnecting } }, file), false);
		assert.ok(!fs.existsSync(file));
	});

	test('connected: the file is written, and startHeartbeat writes it at once', () => {
		const client = { ws: { status: Status.Ready } };
		assert.equal(beat(client, file), true);
		fs.rmSync(file);
		const timer = startHeartbeat(client, file);
		clearInterval(timer);
		assert.ok(Date.now() - fs.statSync(file).mtimeMs < 5000);
	});
});
