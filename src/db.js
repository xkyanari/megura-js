const Sequelize = require('sequelize');
const {
	mysql_dbname,
	mysql_dbuser,
	mysql_dbpass,
	mysql_host,
	mysql_port,
} = require('../config.json');

// Connecting to the database using Sequelize -----------------

const sequelize = new Sequelize(mysql_dbname, mysql_dbuser, mysql_dbpass, {
	host: mysql_host,
	port: mysql_port,
	dialect: 'mysql',
	logging: false,
});

const Player = require('../models/player')(sequelize, Sequelize.DataTypes);
const Monster = require('../models/monster')(sequelize, Sequelize.DataTypes);
const Item = require('../models/item')(sequelize, Sequelize.DataTypes);
const Iura = require('../models/iura')(sequelize, Sequelize.DataTypes);
const Shop = require('../models/shop')(sequelize, Sequelize.DataTypes);
const Quest = require('../models/quest')(sequelize, Sequelize.DataTypes);
const Guild = require('../models/guild')(sequelize, Sequelize.DataTypes);
const Brawl = require('../models/brawl')(sequelize, Sequelize.DataTypes);

const RolePanel = require('../models/rolePanel')(sequelize, Sequelize.DataTypes);
const RolePanelRole = require('../models/rolePanelRole')(sequelize, Sequelize.DataTypes);
const TicketConfig = require('../models/ticketConfig')(sequelize, Sequelize.DataTypes);
const Ticket = require('../models/ticket')(sequelize, Sequelize.DataTypes);
const Form = require('../models/form')(sequelize, Sequelize.DataTypes);
const FormField = require('../models/formField')(sequelize, Sequelize.DataTypes);
const QuestProgress = require('../models/questProgress')(sequelize, Sequelize.DataTypes);
const FactionScore = require('../models/factionScore')(sequelize, Sequelize.DataTypes);
const Exploration = require('../models/exploration')(sequelize, Sequelize.DataTypes);
const FactionContribution = require('../models/factionContribution')(sequelize, Sequelize.DataTypes);

Player.hasOne(Iura, {
	as: 'iura',
	foreignKey: 'accountID',
	onDelete: 'CASCADE',
	onUpdate: 'CASCADE',
});
Player.hasMany(Item, { as: 'item', foreignKey: 'accountID' });

RolePanel.hasMany(RolePanelRole, { as: 'roles', foreignKey: 'panelId', onDelete: 'CASCADE' });
Form.hasMany(FormField, { as: 'fields', foreignKey: 'formId', onDelete: 'CASCADE' });

// Atomic balance helpers -----------------

const { Op } = Sequelize;

const IURA_COLUMNS = {
	wallet: 'walletAmount',
	bank: 'bankAmount',
	stake: 'stakedAmount',
};

const assertAmount = (amount) => {
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new Error('invalid amount');
	}
};

// Moves `amount` from one balance column to another in a single UPDATE.
// Pass null for `from` to only credit, or null for `to` to only debit.
// A debit never lets the source column go negative.
async function moveIura(accountID, from, to, amount, transaction) {
	assertAmount(amount);

	const values = {};
	const where = { accountID };
	if (from) {
		const column = IURA_COLUMNS[from];
		values[column] = sequelize.literal(`\`${column}\` - ${amount}`);
		where[column] = { [Op.gte]: amount };
	}
	if (to) {
		const column = IURA_COLUMNS[to];
		values[column] = sequelize.literal(`\`${column}\` + ${amount}`);
	}

	const [affected] = await Iura.update(values, { where, transaction });
	if (!affected) {
		throw new Error(from ? 'insufficient funds' : 'account not found');
	}
}

// Moves a player's ores into the guild wallet (e.g. a brawl stake).
// Throws 'insufficient funds' without changing anything if the player can't cover it.
async function escrowOres(discordID, guildID, amount, transaction) {
	assertAmount(amount);

	const [affected] = await Player.update(
		{ oresEarned: sequelize.literal(`\`oresEarned\` - ${amount}`) },
		{ where: { discordID, guildID, oresEarned: { [Op.gte]: amount } }, transaction },
	);
	if (!affected) throw new Error('insufficient funds');

	await Guild.increment({ walletAmount: amount }, { where: { guildID }, transaction });
}

// Pays ores from the guild wallet back to a player (e.g. a brawl payout or refund).
// If the player no longer has a profile, the ores stay in the guild wallet.
async function releaseOres(discordID, guildID, amount, transaction) {
	assertAmount(amount);

	const [affected] = await Player.update(
		{ oresEarned: sequelize.literal(`\`oresEarned\` + ${amount}`) },
		{ where: { discordID, guildID }, transaction },
	);
	if (!affected) return false;

	await Guild.decrement({ walletAmount: amount }, { where: { guildID }, transaction });
	return true;
}

// savings (the 'stake' balance)
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
		const shopItem = await Shop.findOne({ where: { item_ID: itemID } });
		if (!shopItem) return;
		const { itemName, level } = shopItem;
		const item = await Item.findOne({ where: { accountID: this.accountID, itemName } });
		if (!item) return;

		return {
			...item.toJSON(),
			level,
		};
	},
});

Reflect.defineProperty(Player.prototype, 'updateItem', {
	value: async function updateItem(itemID, isEquipped) {
		const shopItem = await Shop.findOne({ where: { item_ID: itemID } });
		if (!shopItem) return;
		const item = await Item.findOne({ where: { accountID: this.accountID, itemName: shopItem.itemName } });
		if (!item) return;
		item.equipped = isEquipped;
		return item.save();
	},
});

// adds only the item (no deduction of payment yet) to the user's inventory
Reflect.defineProperty(Player.prototype, 'addItem', {
	value: async function addItem(item, amount = 1) {
		assertAmount(amount);
		const shopItem = await Shop.findOne({ where: { itemName: item } });

		if (!shopItem) return;

		// lock the player so two purchases at once add both, into one row
		return sequelize.transaction(async (transaction) => {
			await Player.findByPk(this.accountID, { transaction, lock: transaction.LOCK.UPDATE });
			const [added] = await Item.increment(
				{ quantity: amount },
				{ where: { accountID: this.accountID, itemName: item }, transaction },
			);
			// MySQL reports affected rows as [[rows, count]] for increment
			const count = Array.isArray(added) ? added[1] : added;
			if (!count) {
				await Item.create({ accountID: this.accountID, itemName: item, quantity: amount }, { transaction });
			}
		});
	},
});

// Adds an item to a server's special shop. Returns false if the ID or name is
// already used by that server or by the global shop (purchases look items up by name).
Reflect.defineProperty(Shop, 'addItem', {
	value: async function addItem(itemName, price, quantity, item_ID, category, guildID) {
		const clash = await this.findOne({
			where: {
				guildID: { [Op.or]: [guildID, null] },
				[Op.or]: [{ item_ID }, { itemName }],
			},
		});
		if (clash) return false;
		await this.create({ itemName, price, quantity, item_ID, category, guildID });
		return true;
	},
});

// removes an item from a server's special shop
Reflect.defineProperty(Shop, 'removeItem', {
	value: async function removeItem(item_ID, guildID) {
		return this.destroy({ where: { item_ID, guildID } });
	},
});

// updates an item in a server's special shop
Reflect.defineProperty(Shop, 'updateItem', {
	value: async function updateItem({ item_ID, guildID, price, stock }) {
		const updatedValues = {};
		if (price !== undefined) {
			updatedValues.price = price;
		}
		if (stock !== undefined) {
			updatedValues.quantity = stock;
		}
		return await this.update(updatedValues, { where: { item_ID, guildID } });
	},
});

// wallet ---> bank (type 'wallet'), or bank ---> stake (type 'bank')
Reflect.defineProperty(Player.prototype, 'deposit', {
	value: async function deposit(amount, type = 'bank') {
		if (type === 'wallet') return moveIura(this.accountID, 'wallet', 'bank', amount);
		if (type === 'bank') return moveIura(this.accountID, 'bank', 'stake', amount);
		throw new Error(`Unknown deposit type: ${type}`);
	},
});

// bank ---> wallet (type 'bank'), or stake ---> bank (type 'stake')
Reflect.defineProperty(Player.prototype, 'withdraw', {
	value: async function withdraw(amount, type) {
		if (type === 'bank') return moveIura(this.accountID, 'bank', 'wallet', amount);
		if (type === 'stake') return moveIura(this.accountID, 'stake', 'bank', amount);
		throw new Error(`Unknown withdraw type: ${type}`);
	},
});

// adds IURA to the wallet
Reflect.defineProperty(Player.prototype, 'addIura', {
	value: async function addIura(amount) {
		return moveIura(this.accountID, null, 'wallet', amount);
	},
});

// deducts IURA from the wallet; throws 'insufficient funds' if it can't cover it
Reflect.defineProperty(Player.prototype, 'spendIura', {
	value: async function spendIura(amount) {
		return moveIura(this.accountID, 'wallet', null, amount);
	},
});

Reflect.defineProperty(Player.prototype, 'updateStats', {
	value: async function updateStats(itemName, add = true, amount = 1) {
		try {
			const shopItem = await Shop.findOne({ where: { itemName } });

			if (!shopItem) {
				throw new Error(`Item ${itemName} not found in Shop`);
			}

			const { totalHealth, totalAttack, totalDefense, category } = shopItem;

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
	Quest,
	Guild,
	Brawl,
	RolePanel,
	RolePanelRole,
	TicketConfig,
	Ticket,
	Form,
	FormField,
	QuestProgress,
	FactionScore,
	Exploration,
	FactionContribution,
	moveIura,
	escrowOres,
	releaseOres,
};
