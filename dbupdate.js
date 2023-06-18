const {
	Monster,
	Shop,
	Contract,
	Quest,
	Player,
	Item,
	Iura,
	Guild,
	Twitter,
	Raid,
	Tweet,
	Order
} = require('./src/db');

(async () => {
	await Shop.sync({ alter: true })
		.then(() => {
			const items = require('./assets/item_db.json');
			for (let item = 0; item < items.length; item++) {
				Shop.create(items[item]);
			}
			console.log('Shop data import completed.');
		})
		.catch((error) => console.log(error));

	await Monster.sync({ force: true })
		.then(() => {
			const monsters = require('./assets/mob_db.json');
			for (let monster = 0; monster < monsters.length; monster++) {
				Monster.create(monsters[monster]);
			}
			console.log('Monster data import completed.');
		})
		.catch((error) => console.log(error));

	await Quest.sync({ force: true })
		.then(() => {
			const quests = require('./assets/quest_db.json');
			for (let quest = 0; quest < quests.length; quest++) {
				Quest.create(quests[quest]);
			}
			console.log('Quest data import completed.');
		})
		.catch((error) => console.log(error));

	await Contract.sync({ force: true })
		.then(() => {
			const contracts = require('./assets/contracts.json');
			for (let contract = 0; contract < contracts.length; contract++) {
				Contract.create(contracts[contract]);
			}
			console.log('Contract data import completed.');
		})
		.catch((error) => console.log(error));

	await Player.sync({ alter: true })
		.then(() => {
			console.log('Player table updated.');
		})
		.catch((error) => console.log(error));

	await Order.sync({ alter: true })
		.then(() => {
			console.log('Order table updated.');
		})
		.catch((error) => console.log(error));

	await Item.sync({ alter: true })
		.then(() => {
			console.log('Item table updated.');
		})
		.catch((error) => console.log(error));

	// await Item.sync({ alter: true })
	// 	.then(() => {
	// 		console.log('Item table updated.');
	// 	})
	// 	.catch((error) => console.log(error));

	// await Iura.sync({ alter: true })
	// 	.then(() => {
	// 		console.log('Iura table refreshed.');
	// 	})
	// 	.catch((error) => console.log(error));

	await Guild.sync({ alter: true })
		.then(() => {
			console.log('Guild table refreshed.');
		})
		.catch((error) => console.log(error));

	// await Twitter.sync({ alter: true })
	// 	.then(() => {
	// 		console.log('Twitter table refreshed.');
	// 	})
	// 	.catch((error) => console.log(error));

	// await Raid.sync({ alter: true })
	// 	.then(() => {
	// 		console.log('Raid table refreshed.');
	// 	})
	// 	.catch((error) => console.log(error));

	// await Tweet.sync({ alter: true })
	// 	.then(() => {
	// 		console.log('Tweet table refreshed.');
	// 	})
	// 	.catch((error) => console.log(error));
})();
