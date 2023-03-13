const Sequelize = require('sequelize');

// Connecting to the database using Sequelize -----------------

const sequelize = new Sequelize('megura', 'user', 'password',  
{
	host: 'localhost',
	dialect: 'sqlite',
	// logging: (...msg) => console.log(msg),
	logging: false,
	storage: 'megura.db', // database filename
}
);

const Player = require('../models/player')(sequelize, Sequelize.DataTypes);
const Monster = require('../models/monster')(sequelize, Sequelize.DataTypes);
const Item = require('../models/item')(sequelize, Sequelize.DataTypes);
const Iura = require('../models/iura')(sequelize, Sequelize.DataTypes);
const Shop = require('../models/shop')(sequelize, Sequelize.DataTypes);
const Contract = require('../models/contract')(sequelize, Sequelize.DataTypes);
const Quest = require('../models/quest')(sequelize, Sequelize.DataTypes);

Player.hasOne(Iura, { as: 'iura', foreignKey: 'accountID', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Player.hasMany(Item, { as: 'item', foreignKey: 'accountID' });
// Monster.hasMany(Loot, { as: 'loot', foreignKey: 'lootID' });

// check balance
Reflect.defineProperty(Player.prototype, 'balance', {
	value: async function balance() {
			return Iura.findOne({ where: { accountID: this.accountID }});
	}
});

// lookup items
Reflect.defineProperty(Player.prototype, 'getItems', {
	value: async function getItems() {
		return Item.findAll({ where: { accountID: this.accountID }});
	}
});

// adds only the item (no deduction of payment yet)
Reflect.defineProperty(Player.prototype, 'addItem', {
	value: async function addItem(item, amount = 1) {
		const { itemID } = await Shop.findOne({ where: { itemName: item }});

		if (!itemID) return;

		const purchasedItem = await Item.findOne({ where: { accountID: this.accountID, itemName: item }});

		if (purchasedItem) {
			purchasedItem.quantity += amount;
			return purchasedItem.save();
		}

		await this.createItem({ itemName: item, quantity: amount });
	}
});

Reflect.defineProperty(Player.prototype, 'deposit', {
	value: async function deposit(amount, type='bank') {
		const iura = await Iura.findOne({ where: { accountID: this.accountID }});

		if (type === 'wallet') {
			// wallet ---> bank
			Iura.decrement({ walletAmount: amount }, { where: { accountID: this.accountID } });
			Iura.increment({ bankAmount: amount }, { where: { accountID: this.accountID } });
			return iura.save();
		} else if (type === 'bank'){
			// bank ---> stake
			Iura.decrement({ bankAmount: amount }, { where: { accountID: this.accountID } });
			Iura.increment({ stakedAmount: amount }, { where: { accountID: this.accountID } });
			return iura.save();
		}
	}
});

Reflect.defineProperty(Player.prototype, 'withdraw', {
	value: async function withdraw(amount, type='wallet') {
		const iura = await Iura.findOne({ where: { accountID: this.accountID }});

		if (type === 'wallet') {
			iura.walletAmount += Number(amount);
			return iura.save();
		} else if (type === 'bank') {
			// bank ---> wallet
			Iura.decrement({ bankAmount: amount }, { where: { accountID: this.accountID } });
			Iura.increment({ walletAmount: amount }, { where: { accountID: this.accountID } });
			return iura.save();
		} else if (type === 'stake') {
			// stake ---> bank
			Iura.decrement({ stakedAmount: amount }, { where: { accountID: this.accountID } });
			Iura.increment({ bankAmount: amount }, { where: { accountID: this.accountID } });
			return iura.save();
		}
	}
});

Reflect.defineProperty(Player.prototype, 'updateStats', {
	value: async function updateStats(item, amount = 1) {
		const { itemID, totalHealth, totalAttack, totalDefense } = await Shop.findOne({ where: { itemName: item }});
		const newTotalHealth = totalHealth * amount;
		const newTotalAttack = totalAttack * amount;
		const newTotalDefense = totalDefense * amount;

		if (!itemID) return;

		await this.increment({ totalHealth: newTotalHealth, totalAttack: newTotalAttack, totalDefense: newTotalDefense }, { where: { accountID: this.accountID }})
		return this.save();
	}
});

module.exports = { sequelize, Player, Monster, Item, Iura, Shop, Contract, Quest };