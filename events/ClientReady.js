const { Events, ActivityType, EmbedBuilder, userMention, WebhookClient } = require('discord.js');
const { sequelize, Guild } = require('../src/db');
// const { port } = require('../config.json');
const { dahliaName, dahliaAvatar } = require('../config.json');

let Discord;
try {
	Discord = require('discord.js');
}
catch (e) {
	console.log(e.stack);
	console.log(process.version);
	console.log('Please run npm install and ensure it passes with no errors!');
	process.exit();
}

/**
 * This event is fired once the bot is connected.
 */

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		client.user.setPresence({
			activities: [
				{
					name: '\/start | \/info',
					type: ActivityType.Listening,
				},
			],
			status: 'dnd',
		});
		console.log(
			`You're now connected as ${client.user.tag}.\nNode version: ${process.version}\nDiscord.js version: ${Discord.version}`,
		);

		const sync = {
			default: {},
			alter: {
				alter: true,
			},
			force: {
				force: true,
			},
		};

		await sequelize.sync(sync.default);
		console.log('Database connection successful.');

		// app.listen(port, () => {
		// 	console.log(`Express server is running on http://localhost:${port}`);
		// });

	},
};
