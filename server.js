const express = require('express');
const {
	port,
	dblWebhookSecret,
	topWebhookSecret,
} = require('./config.json');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const cors = require('cors');
const { twitterCallback } = require('./functions/twitter');
const { voteWebhook } = require('./functions/vote');

// Express server
const app = express();

const limiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 25,
});

app.use(bodyParser.json());
app.use(limiter);
app.use(
	cors(),
	// for production to limit the request
	// cors({
	//     origin: "http://localhost:3000", // Replace with your frontend origin
	// })
);

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
	res.render('index');
});

app.get('/connect', (req, res) => {
	res.render('wallet');
});

app.get('/twitter/auth/callback', async (req, res) => {
	await twitterCallback(req, res);
});

app.post('/dbl/upvote', async (req, res) => {
	if (
		req.headers.authorization !== dblWebhookSecret ||
    req.headers.referer !== 'discordbotlist.com'
	) {
		console.log('Unauthorized request');
		return res.sendStatus(403);
	}

	const { id } = req.body;

	await voteWebhook(id);

	return res.sendStatus(200);
});

app.post('/top/upvote', async (req, res) => {
	console.log('Referer: ', req.headers.referer);
	if (
		req.headers.authorization !== topWebhookSecret ||
    req.headers.referer !== 'top.gg'
	) {
		console.log('Unauthorized request');
		return res.sendStatus(403);
	}

	const { user, isWeekend } = req.body;
	const votes = isWeekend ? 2 : 1;

	await voteWebhook(user, votes);

	return res.sendStatus(200);
});

module.exports = app;