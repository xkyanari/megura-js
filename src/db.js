const Sequelize = require('sequelize');
const { mysql_dbname, mysql_dbuser, mysql_dbpass } = require('../config.json');

// Connecting to the database using Sequelize -----------------

const sequelize = new Sequelize(mysql_dbname, mysql_dbuser, mysql_dbpass, {
	host: '172.20.0.1', // localhost
	dialect: 'mysql',
	logging: false,
});

const Player = require('../models/player')(sequelize, Sequelize.DataTypes);
const Monster = require('../models/monster')(sequelize, Sequelize.DataTypes);
const Item = require('../models/item')(sequelize, Sequelize.DataTypes);
const Iura = require('../models/iura')(sequelize, Sequelize.DataTypes);
const Shop = require('../models/shop')(sequelize, Sequelize.DataTypes);
const Guild = require('../models/guild')(sequelize, Sequelize.DataTypes);
const Order = require('../models/order')(sequelize, Sequelize.DataTypes);

Player.hasOne(Iura, {
	as: 'iura',
	foreignKey: 'accountID',
	onDelete: 'CASCADE',
	onUpdate: 'CASCADE',
});
Player.hasMany(Item, { as: 'item', foreignKey: 'accountID' });

// for staking
Reflect.defineProperty(Player.prototype, 'stake', {
	value: async function stake() {
		return Iura.findAll({ where: { guildID: this.guildID } });
	},
});

// check balance
Reflect.defineProperty(Player.prototype, 'balance', {
	value: async function balance() {
		return Iura.findOne({ where: { accountID: this.accountID } });
	},
});

// lookup items
Reflect.defineProperty(Player.prototype, 'getItems', {
	value: async function getItems(equipped) {
		const whereClause = { accountID: this.accountID };
		if (equipped !== undefined) {
			whereClause.equipped = equipped;
		}
		return Item.findAll({ where: whereClause });
	},
});

Reflect.defineProperty(Player.prototype, 'getItem', {
	value: async function getItem(itemID) {
		const { itemName, level } = await Shop.findOne({ where: { item_ID: itemID } });
		const item = await Item.findOne({ where: { accountID: this.accountID, itemName } });

		return {
			...item.toJSON(),
			level,
		};
	},
});

Reflect.defineProperty(Player.prototype, 'updateItem', {
	value: async function updateItem(itemID, isEquipped) {
		const { itemName } = await Shop.findOne({ where: { item_ID: itemID } });
		const item = await Item.findOne({ where: { accountID: this.accountID, itemName } });
		item.equipped = isEquipped;
		return item.save();
	},
});

// adds only the item (no deduction of payment yet) to the user's inventory
Reflect.defineProperty(Player.prototype, 'addItem', {
	value: async function addItem(item, amount = 1) {
		const { itemID } = await Shop.findOne({ where: { itemName: item } });

		if (!itemID) return;

		const purchasedItem = await Item.findOne({
			where: { accountID: this.accountID, itemName: item },
		});

		if (purchasedItem) {
			purchasedItem.quantity += amount;
			return purchasedItem.save();
		}

		await this.createItem({ itemName: item, quantity: amount });
	},
});

// adds an item to the Shop
Reflect.defineProperty(Shop, 'addItem', {
	value: async function addItem(itemName, price, quantity, item_ID, category, guildID) {
		return await this.upsert({ itemName, price, quantity, item_ID, category, guildID });
	},
});

// removes an item from the Shop
Reflect.defineProperty(Shop, 'removeItem', {
	value: async function removeItem(item_ID) {
		const shopItem = await this.findOne({ where: { item_ID } });
		if (shopItem) return await this.destroy({ where: { item_ID } });
		return;
	},
});

// updates an item from the Shop
Reflect.defineProperty(Shop, 'updateItem', {
	value: async function updateItem({ item_ID, price, stock }) {
		const updatedValues = {};
		if (price !== undefined) {
			updatedValues.price = price;
		}
		if (stock !== undefined) {
			updatedValues.quantity = stock;
		}
		return await this.update(updatedValues, { where: { item_ID } });
	},
});

// buy an item from the Shop
Reflect.defineProperty(Shop, 'buyItem', {
	value: async function buyItem(item, quantity, discordID, guildID) {

		const shopItem = await this.findOne({ where: { itemName: item } });

		const user = await Player.findOne({ where: { discordID, guildID } });
		const guild = await Guild.findOne({ where: { guildID } });

		// Update user balance
		await Player.update({ oresEarned: user.oresEarned - shopItem.price * quantity }, { where: { discordID } });

		// Update guild wallet
		await Guild.update({ walletAmount: guild.walletAmount + shopItem.price * quantity }, { where: { guildID } });

		// Update shop stock
		await this.update({ quantity: shopItem.quantity - quantity }, { where: { itemName: item } });

		return;
	},
});

// refund the ores to the player
Reflect.defineProperty(Shop, 'returnOres', {
	value: async function returnOres(item, quantity, discordID, guildID) {
		const shopItem = await this.findOne({ where: { itemName: item } });
		const user = await Player.findOne({ where: { discordID, guildID } });
		const guild = await Guild.findOne({ where: { guildID } });

		const oreReturned = shopItem.price * quantity;

		// Refund ores to user
		await Player.update({ oresEarned: user.oresEarned + oreReturned }, { where: { discordID } });

		// Deduct from guild wallet
		await Guild.update({ walletAmount: guild.walletAmount - oreReturned }, { where: { guildID } });

		// Increase shop stock
		await this.update({ quantity: shopItem.quantity + quantity }, { where: { itemName: item } });

		return oreReturned;
	},
});


// gets an item from the Shop
Reflect.defineProperty(Shop, 'getItem', {
	value: async function getItem(item_ID) {
		const shopItem = await this.findOne({ where: { item_ID } });
		if (!shopItem) return;
		return {
			...shopItem.toJSON(),
		};
	},
});

Reflect.defineProperty(Player.prototype, 'deposit', {
	value: async function deposit(amount, type = 'bank') {
		const iura = await Iura.findOne({ where: { accountID: this.accountID } });

		if (type === 'wallet') {
			// wallet ---> bank
			Iura.decrement(
				{ walletAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			Iura.increment(
				{ bankAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			return iura.save();
		}
		else if (type === 'bank') {
			// bank ---> stake
			Iura.decrement(
				{ bankAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			Iura.increment(
				{ stakedAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			return iura.save();
		}
	},
});

Reflect.defineProperty(Player.prototype, 'withdraw', {
	value: async function withdraw(amount, type = 'wallet') {
		const iura = await Iura.findOne({ where: { accountID: this.accountID } });

		if (type === 'wallet') {
			iura.walletAmount += Number(amount);
			return iura.save();
		}
		else if (type === 'bank') {
			// bank ---> wallet
			Iura.decrement(
				{ bankAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			Iura.increment(
				{ walletAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			return iura.save();
		}
		else if (type === 'stake') {
			// stake ---> bank
			Iura.decrement(
				{ stakedAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			Iura.increment(
				{ bankAmount: amount },
				{ where: { accountID: this.accountID } },
			);
			return iura.save();
		}
	},
});

Reflect.defineProperty(Player.prototype, 'updateStats', {
	value: async function updateStats(itemName, add = true, amount = 1) {
		try {
			const { itemID, totalHealth, totalAttack, totalDefense, category } =
				await Shop.findOne({ where: { itemName } });

			if (!itemID) {
				throw new Error(`Item ${itemName} not found in Shop`);
			}

			const newTotalHealth = totalHealth * amount;
			const newTotalAttack = totalAttack * amount;
			const newTotalDefense = totalDefense * amount;

			const updateObj = {
				totalHealth: add ? newTotalHealth : -newTotalHealth,
				totalAttack: add ? newTotalAttack : -newTotalAttack,
				totalDefense: add ? newTotalDefense : -newTotalDefense,
			};

			await this.increment(
				updateObj,
				{ where: { accountID: this.accountID } },
			);

			if (add) {
				if (category === 'weapons') {
					this.weapon = itemName;
				}
				if (category === 'armor') {
					this.armor = itemName;
				}

				// quantity --> equippedAmount
				await Item.increment(
					{ equippedAmount: amount },
					{ where: { accountID: this.accountID, itemName } },
				);

				await Item.decrement(
					{ quantity: amount },
					{ where: { accountID: this.accountID, itemName } },
				);
			}
			else {
				if (category === 'weapons') {
					this.weapon = 'Basic Sword';
				}
				if (category === 'armor') {
					this.armor = 'Basic Clothes';
				}

				// equippedAmount --> quantity
				await Item.decrement(
					{ equippedAmount: amount },
					{ where: { accountID: this.accountID, itemName } },
				);

				await Item.increment(
					{ quantity: amount },
					{ where: { accountID: this.accountID, itemName } },
				);
			}

			return this.save();
		}
		catch (error) {
			console.error(`Error updating stats: ${error}`);
		}
	},
});

module.exports = {
	sequelize,
	Player,
	Monster,
	Item,
	Iura,
	Shop,
	Guild,
	Order,
};
