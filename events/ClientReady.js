const { Events, ActivityType } = require('discord.js');
const { sequelize, Player } = require('../src/db');
const cron = require('node-cron');
const refresh = require('../functions/refresh');

let Discord;
try {
  Discord = require("discord.js");
} catch (e) {
  console.log(e.stack);
  console.log(process.version);
  console.log("Please run npm install and ensure it passes with no errors!");
  process.exit();
}

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		client.user.setPresence({ activities: [{ name: `\/start | \/info`, type: ActivityType.Listening }], status: 'dnd' });
		console.log( `You're now connected as ${client.user.tag}.\nNode version: ${process.version}\nDiscord.js version: ${Discord.version}` );

		const sync = {
			default: {},
			alter: { alter: true },
			force: { force: true }
		};

		const data = await sequelize.sync(sync.default);
		console.log("Database connection successful.");
		
		// uncomment only when sync.force is running in dev
		// if (data) {
		// 	await refresh();
		// }
		
		// for running scheduled tasks
		// cron.schedule('* * * * *', function() {
		// 	const date = new Date(); // date now
		// 	console.log(`<${date.toLocaleString()}> Standing by...`);
		// });

	},
};