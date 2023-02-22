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

	sequelize.sync({force: true}) // { alter/force: true }
		.then(data => console.log("Database connection successful."))
		.then(() => {
			const quests = require('../assets/quest_db.json');
			for (let quest = 0; quest < quests.length; quest++) {
				Quest.create(quests[quest]);
			}
			console.log("Quest data import completed.")
		})
		.then(() => {
			const monsters = require('../assets/mob_db.json');
			for (let monster = 0; monster < monsters.length; monster++) {
				Monster.create(monsters[monster]);
			}
			console.log("Monster data import completed.")
		})
		.then(() => {
			const items = require('../assets/item_db.json');
			for (let item = 0; item < items.length; item++) {
				Shop.create(items[item]);
			}
			console.log("Item data import completed.")
		})
		.then(() => {
			const contracts = require('../assets/contracts.json');
			for (let contract = 0; contract < contracts.length; contract++) {
				Contract.create(contracts[contract]);
			}
			console.log("Contract data import completed.")
		})
		// importing from the old db
		.then(() => {
			return Player.create({ guildID: '1073827215957032960', discordID: '119671611803697152', playerName: 'Kyanari', faction: 'Margaretha' });
		})
		.then((kyanari) => {
			return kyanari.createIura({ walletName: 'Kyanari', bankName: 'Kyanari', walletAmount: '10000000' });
		})
		// .then(() => {
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '566767755915821056', playerName: 'boo', faction: 'Cerberon' });
		// })
		// .then((dataA) => {
		// 	dataA.createIura({ walletName: 'boo', bankName: 'boo', walletAmount: '10000000' });
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '919448412502519808', playerName: 'Julio Valiente', faction: 'Cerberon' });
		// })
		// .then((dataB) => {
		// 	return dataB.createIura({ walletName: 'Julio Valiente', bankName: 'Julio Valiente', walletAmount: '100' });
		// })
		// .then(() => {
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '612700763541733409', playerName: 'Hentai Lord', faction: 'Cerberon' });
		// })
		// .then((dataC) => {
		// 	dataC.createIura({ walletName: 'Hentai Lord', bankName: 'Hentai Lord', walletAmount: '100' });
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '240105227531845632', playerName: 'Lenexy', faction: 'Margaretha' });
		// })
		// .then((dataD) => {
		// 	return dataD.createIura({ walletName: 'Lenexy', bankName: 'Lenexy', walletAmount: '100' });
		// })
		// .then(() => {
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '395262443846107136', playerName: 'Raych', faction: 'Cerberon' });
		// })
		// .then((dataE) => {
		// 	dataE.createIura({ walletName: 'Raych', bankName: 'Raych', walletAmount: '100' });
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '282772521919447040', playerName: '177013', faction: 'Cerberon' });
		// })
		// .then((dataF) => {
		// 	return dataF.createIura({ walletName: '177013', bankName: '177013', walletAmount: '100' });
		// })
		// .then(() => {
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '930685195475099658', playerName: 'Lone Drifter', faction: 'Cerberon' });
		// })
		// .then((dataG) => {
		// 	return dataG.createIura({ walletName: 'Lone Drifter', bankName: 'Lone Drifter', walletAmount: '100' });
		// })
		// .then(() => {
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '248890983985577984', playerName: 'Altz', faction: 'Cerberon' });
		// })
		// .then((dataH) => {
		// 	return dataH.createIura({ walletName: 'Altz', bankName: 'Altz', walletAmount: '100' });
		// })
		// .then(() => {
		// 	return Player.create({ guildID: '1032034043686035508', discordID: '111289101176565760', playerName: 'Nyasuri', faction: 'Cerberon' });
		// })
		// .then((dataI) => {
		// 	return dataI.createIura({ walletName: 'Nyasuri', bankName: 'Nyasuri', walletAmount: '100' });
		// })
		// .then(() => console.log("Profiles created successfully."))
		.catch((error) => {
			console.log("Error database connection.");
			console.log(error);
		});
	},
};