const { Events, ActivityType } = require('discord.js');
const { sequelize, Monster, Player, Shop, Contract, Quest } = require('../src/db');

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

	sequelize.sync({alter:true}) // { alter/force: true }
		.then((data) => console.log("Database connection successful."))
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
		// .then(() => {
		// 	return Player.create({ guildID: '1073827215957032960', discordID: '119671611803697152', playerName: 'Kyanari', faction: 'Margaretha', totalAttack: '99999', totalDefense: '99999', totalHealth: '99999' });
		// })
		// .then((kyanari) => {
		// 	return kyanari.createIura({ walletName: 'Kyanari', bankName: 'Kyanari', walletAmount: '999999999' });
		// })
		.catch((error) => {
			console.log("Error database connection.\n", error);
		});
	},
};