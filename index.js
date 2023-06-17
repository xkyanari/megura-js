const express = require('express');
const { Client, GatewayIntentBits, Collection, Options } = require('discord.js');
const {
	token,
	port,
	dblWebhookSecret,
	topWebhookSecret,
} = require('./config.json');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const { twitterCallback } = require('./functions/twitter');
const { voteWebhook } = require('./functions/vote');
const logs = require('discord-logs');

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

// app.listen(port, () => {
// 	console.log(`Express server is running on http://localhost:${port}`);
// });

// Discord bot
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildPresences,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildWebhooks,
	],
	// sweepers: Options.DefaultSweeperSettings,
});

logs(client, { debug: true });

client.commands = new Collection();
client.subCommands = new Collection();
client.buttons = new Collection();
client.menus = new Collection();
client.modals = new Collection();
client.cooldown = new Collection();
client.userData = new Collection();

// For registering slash commands -----------------

const slashCommandsPath = path.join(__dirname, 'commands', 'slash-commands');
const slashCommandFiles = fs
	.readdirSync(slashCommandsPath)
	.filter((file) => file.endsWith('.js'));

for (const file of slashCommandFiles) {
	const filePath = path.join(slashCommandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command && 'cooldown' in command) {
		client.commands.set(command.data.name, command);
	}
	else {
		console.log(
			`[WARNING] The command at ${filePath} is missing a required "data" or "execute" or "cooldown" property.`,
		);
	}
}

// For registering text commands -----------------

const textCommandsPath = path.join(__dirname, 'commands', 'text-commands');
const textCommandFiles = fs
	.readdirSync(textCommandsPath)
	.filter((file) => file.endsWith('.js'));

for (const file of textCommandFiles) {
	const filePath = path.join(textCommandsPath, file);
	const command = require(filePath);
	if ('name' in command && 'execute' in command) {
		client.commands.set(command.name, command);
	}
	else {
		console.log(
			`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`,
		);
	}
}

// For running events -----------------

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs
	.readdirSync(eventsPath)
	.filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// For running components -----------------

const componentsPath = fs.readdirSync('./components');
for (const folder of componentsPath) {
	const componentFiles = fs
		.readdirSync(`./components/${folder}`)
		.filter((file) => file.endsWith('.js'));

	const { buttons, menus, modals } = client;

	switch (
		folder // buttons
	) {
		case 'buttons':
			for (const file of componentFiles) {
				const button = require(`./components/${folder}/${file}`);
				buttons.set(button.data.name, button);
			}
			break;

			// select menus
		case 'menus':
			for (const file of componentFiles) {
				const menu = require(`./components/${folder}/${file}`);
				menus.set(menu.data.name, menu);
			}
			break;

			// modals
		case 'modals':
			for (const file of componentFiles) {
				const modal = require(`./components/${folder}/${file}`);
				modals.set(modal.data.name, modal);
			}
			break;
		default:
			break;
	}
}

client.login(token);
