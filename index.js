const { Client, GatewayIntentBits, Collection } = require('discord.js');
const {	token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');
const logs = require('discord-logs');

// Discord bot
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.GuildWebhooks,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.DirectMessageTyping,
		GatewayIntentBits.DirectMessageReactions,
	],
	// sweepers: Options.DefaultSweeperSettings,
});

logs(client, { debug: false });

client.commands = new Collection();
client.subCommands = new Collection();
client.buttons = new Collection();
client.menus = new Collection();
client.modals = new Collection();
client.cooldown = new Collection();

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

const componentsPath = path.join(__dirname, 'components');
const componentFolders = fs.readdirSync(componentsPath);
for (const folder of componentFolders) {
	const folderPath = path.join(componentsPath, folder);
	const componentFiles = fs
		.readdirSync(folderPath)
		.filter((file) => file.endsWith('.js'));

	const { buttons, menus, modals } = client;

	switch (
		folder // buttons
	) {
		case 'buttons':
			for (const file of componentFiles) {
				const button = require(path.join(folderPath, file));
				buttons.set(button.data.name, button);
			}
			break;

			// select menus
		case 'menus':
			for (const file of componentFiles) {
				const menu = require(path.join(folderPath, file));
				menus.set(menu.data.name, menu);
			}
			break;

			// modals
		case 'modals':
			for (const file of componentFiles) {
				const modal = require(path.join(folderPath, file));
				modals.set(modal.data.name, modal);
			}
			break;
		default:
			break;
	}
}

client.login(token);
