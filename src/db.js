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
const Order = require('../models/order')(sequelize, Sequelize.DataTypes);
const Brawl = require('../models/brawl')(sequelize, Sequelize.DataTypes);

const Auction = require('../models/auction')(sequelize, Sequelize.DataTypes);
const User = require('../models/user')(sequelize, Sequelize.DataTypes);
const Bid = require('../models/bid')(sequelize, Sequelize.DataTypes);
const AuctionItem = require('../models/auctionItem')(sequelize, Sequelize.DataTypes);
const Raffle = require('../models/raffle')(sequelize, Sequelize.DataTypes);
const RaffleTicket = require('../models/raffleTicket')(sequelize, Sequelize.DataTypes);
const Giveaway = require('../models/giveaway')(sequelize, Sequelize.DataTypes);
const GiveawayEntry = require('../models/giveawayEntry')(sequelize, Sequelize.DataTypes);
const RolePanel = require('../models/rolePanel')(sequelize, Sequelize.DataTypes);
const RolePanelRole = require('../models/rolePanelRole')(sequelize, Sequelize.DataTypes);

Player.hasOne(Iura, {
	as: 'iura',
	foreignKey: 'accountID',
	onDelete: 'CASCADE',
	onUpdate: 'CASCADE',
});
Player.hasMany(Item, { as: 'item', foreignKey: 'accountID' });

User.hasMany(Bid, { foreignKey: 'userId' });
Bid.belongsTo(User, { foreignKey: 'userId' });
Auction.hasMany(Bid, { foreignKey: 'auctionId' });
Bid.belongsTo(Auction, { foreignKey: 'auctionId' });
Auction.belongsTo(User, { as: 'Winner', foreignKey: 'winnerId' });
User.hasMany(Auction, { as: 'WonAuctions', foreignKey: 'winnerId' });
AuctionItem.hasOne(Auction, { foreignKey: 'itemId' });
Auction.belongsTo(AuctionItem, { foreignKey: 'itemId' });
Giveaway.hasMany(GiveawayEntry, { as: 'entries', foreignKey: 'giveawayId', onDelete: 'CASCADE' });
Raffle.hasMany(RaffleTicket, { as: 'tickets', foreignKey: 'raffleId', onDelete: 'CASCADE' });
RolePanel.hasMany(RolePanelRole, { as: 'roles', foreignKey: 'panelId', onDelete: 'CASCADE' });

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

// Moves `amount` from one player's wallet to another's, all or nothing.
async function transferIura(fromAccountID, toAccountID, amount) {
	return sequelize.transaction(async (transaction) => {
		await moveIura(fromAccountID, 'wallet', null, amount, transaction);
		await moveIura(toAccountID, null, 'wallet', amount, transaction);
	});
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
		const shopItem = await Shop.findOne({ where: { itemName: item } });

		if (!shopItem) return;

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

// buy a guild item from the Shop, paid in ores
Reflect.defineProperty(Shop, 'buyItem', {
	value: async function buyItem(item, quantity, discordID, guildID) {
		assertAmount(quantity);

		return sequelize.transaction(async (transaction) => {
			const shopItem = await this.findOne({
				where: { itemName: item, guildID },
				transaction,
				lock: transaction.LOCK.UPDATE,
			});
			if (!shopItem) throw new Error('item not found');
			if (shopItem.quantity < quantity) throw new Error('out of stock');

			const cost = shopItem.price * quantity;

			// Deduct from the player, only if they can afford it
			const [affected] = await Player.update(
				{ oresEarned: sequelize.literal(`\`oresEarned\` - ${cost}`) },
				{ where: { discordID, guildID, oresEarned: { [Op.gte]: cost } }, transaction },
			);
			if (!affected) throw new Error('insufficient funds');

			await Guild.increment({ walletAmount: cost }, { where: { guildID }, transaction });
			await shopItem.decrement({ quantity }, { transaction });
		});
	},
});

// refund the ores to the player; returns the amount refunded
// (0 if the player no longer has a profile, in which case the ores stay in the guild wallet)
Reflect.defineProperty(Shop, 'returnOres', {
	value: async function returnOres(item, quantity, discordID, guildID) {
		assertAmount(quantity);

		return sequelize.transaction(async (transaction) => {
			const shopItem = await this.findOne({
				where: { itemName: item, guildID },
				transaction,
				lock: transaction.LOCK.UPDATE,
			});
			if (!shopItem) throw new Error('item not found');

			const oreReturned = shopItem.price * quantity;

			const refunded = await releaseOres(discordID, guildID, oreReturned, transaction);
			await shopItem.increment({ quantity }, { transaction });

			return refunded ? oreReturned : 0;
		});
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
	Order,
	Auction,
	User,
	Bid,
	AuctionItem,
	Brawl,
	Giveaway,
	GiveawayEntry,
	Raffle,
	RaffleTicket,
	RolePanel,
	RolePanelRole,
	moveIura,
	transferIura,
	escrowOres,
	releaseOres,
};
