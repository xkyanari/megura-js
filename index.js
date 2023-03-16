// "use strict"

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

const client = new Client({
	intents: [GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]});

// For registering and loading slash commands -----------------

client.commands = new Collection();
client.subCommands = new Collection();
client.buttons = new Collection();
client.menus = new Collection();
client.cooldown = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command && 'cooldown' in command) {
		client.commands.set(command.data.name, command);
	} else {
		console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" or "cooldown" property.`);
	}
}

// For running events -----------------

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	} else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// // For running components -----------------

const componentsPath = fs.readdirSync(`./components`);
for (const folder of componentsPath) {
	const componentFiles = fs.readdirSync(`./components/${folder}`).filter(file => file.endsWith('.js'));

	const { buttons, menus } = client;

	// buttons
	switch (folder) {
		case "buttons":
			for (const file of componentFiles) {
				const button = require(`./components/${folder}/${file}`);
				buttons.set(button.data.name, button);
			}
			break;
		
		default:
			break;
	}

	// select menus
	switch (folder) {
		case "menus":
			for (const file of componentFiles) {
				const menu = require(`./components/${folder}/${file}`);
				menus.set(menu.data.name, menu);
			}
			break;
		
		default:
			break;
	}
}

client.login(token);