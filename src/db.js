const Sequelize = require('sequelize');

// Connecting to the database using Sequelize -----------------

const sequelize = new Sequelize('megura', 'user', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'megura.db', // database filename
});

const Player = require('../models/player')(sequelize, Sequelize.DataTypes);
const Monster = require('../models/monster')(sequelize, Sequelize.DataTypes);
const Item = require('../models/item')(sequelize, Sequelize.DataTypes);
const Iura = require('../models/iura')(sequelize, Sequelize.DataTypes);

Player.hasOne(Iura, { as: 'iura', foreignKey: 'accountID', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
Player.hasMany(Item, { as: 'item', foreignKey: 'ownerID' });
// Monster.hasMany(Item, { as: 'loot', foreignKey: 'lootID' });

module.exports = { sequelize, Player, Monster, Item, Iura };