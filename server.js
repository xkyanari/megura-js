const crypto = require('node:crypto');
const express = require('express');
const {
	dblWebhookSecret,
	topWebhookSecret,
} = require('./config.json');
const rateLimit = require('express-rate-limit');
const { voteWebhook } = require('./functions/vote');

// Constant-time comparison so the secret can't be guessed byte by byte
const isAuthorized = (header, secret) => {
	if (!header || !secret) return false;
	const a = Buffer.from(header);
	const b = Buffer.from(secret);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Express server
const app = express();

// Behind a reverse proxy (nginx, Cloudflare), set TRUST_PROXY to the number of
// proxies in front so rate limits see the visitor's address, not the proxy's.
const trustProxy = Number(process.env.TRUST_PROXY);
if (Number.isInteger(trustProxy) && trustProxy > 0) app.set('trust proxy', trustProxy);

// Only the public page is rate limited: top.gg and DBL send every vote from a
// handful of addresses, and those routes already require the shared secret.
const limiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 25,
});

app.use(express.json({ limit: '10kb' }));

app.set('view engine', 'ejs');

app.get('/', limiter, (req, res) => {
	res.render('index');
});

app.post('/dbl/upvote', async (req, res) => {
	if (!isAuthorized(req.headers.authorization, dblWebhookSecret)) {
		console.log('Unauthorized request');
		return res.sendStatus(403);
	}

	try {
		await voteWebhook(req.body.id);
		return res.sendStatus(200);
	}
	catch (error) {
		console.error(error);
		return res.sendStatus(500);
	}
});

app.post('/top/upvote', async (req, res) => {
	if (!isAuthorized(req.headers.authorization, topWebhookSecret)) {
		console.log('Unauthorized request');
		return res.sendStatus(403);
	}

	const { user, isWeekend } = req.body;
	const votes = isWeekend ? 2 : 1;

	try {
		await voteWebhook(user, votes);
		return res.sendStatus(200);
	}
	catch (error) {
		console.error(error);
		return res.sendStatus(500);
	}
});

// Starts the vote webhook server if VOTE_PORT is set. Returns the server, or null.
const startVoteServer = (port = process.env.VOTE_PORT) => {
	const portNumber = Number(port);
	if (!Number.isInteger(portNumber) || portNumber <= 0) return null;
	return app.listen(portNumber, () => console.log(`Vote webhook server listening on port ${portNumber}`));
};

module.exports = app;
module.exports.startVoteServer = startVoteServer;
