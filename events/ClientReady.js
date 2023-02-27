const { Events, ActivityType } = require('discord.js');
const { sequelize, Monster, Player, Shop } = require('../src/db');

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
		client.user.setPresence({ activities: [{ name: 'Messinia Graciene', type: ActivityType.Playing }], status: 'dnd' });
	console.log( `You're now connected as ${client.user.tag}.\nNode version: ${process.version}\nDiscord.js version: ${Discord.version}` );

	sequelize.sync({ alter: true }) // { alter/force: true }
		.then((data) => console.log("Database connection successful.", data))
		// .then(() => {
		// 	const quests = require('../assets/quest_db.json');
		// 	for (let quest = 0; quest < quests.length; quest++) {
		// 		Quest.create(quests[quest]);
		// 	}
		// 	console.log("Quest data import completed.")
		// })
		// .then(() => {
		// 	const monsters = require('../assets/mob_db.json');
		// 	for (let monster = 0; monster < monsters.length; monster++) {
		// 		Monster.create(monsters[monster]);
		// 	}
		// 	console.log("Monster data import completed.")
		// })
		// .then(() => {
		// 	const items = require('../assets/item_db.json');
		// 	for (let item = 0; item < items.length; item++) {
		// 		Shop.create(items[item]);
		// 	}
		// 	console.log("Item data import completed.")
		// })
		// .then(() => {
		// 	const contracts = require('../assets/contracts.json');
		// 	for (let contract = 0; contract < contracts.length; contract++) {
		// 		Contract.create(contracts[contract]);
		// 	}
		// 	console.log("Contract data import completed.")
		// })
		.catch((error) => {
			console.log("Error database connection.");
			console.log(error);
		});
	},
};