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

const limiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 25,
});

app.use(express.json());
app.use(limiter);

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
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

module.exports = app;
