module.exports = (sequelize, DataTypes) => {
	const Player = sequelize.define(
		'Player',
		{
			accountID: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildID: DataTypes.TEXT,
			discordID: DataTypes.TEXT,
			playerName: DataTypes.TEXT,
			timeline: {
				type: DataTypes.TEXT,
				allowNull: false,
				defaultValue: 'past',
			},
			faction: DataTypes.TEXT,
			level: {
				type: DataTypes.INTEGER,
				defaultValue: 1,
			},
			totalHealth: {
				type: DataTypes.INTEGER,
				defaultValue: 2000,
				allowNull: false,
			},
			totalAttack: {
				type: DataTypes.INTEGER,
				defaultValue: 500,
				allowNull: false,
			},
			totalDefense: {
				type: DataTypes.INTEGER,
				defaultValue: 500,
				allowNull: false,
			},
			weapon: {
				type: DataTypes.TEXT,
				defaultValue: 'Basic Sword',
			},
			armor: {
				type: DataTypes.TEXT,
				defaultValue: 'Basic Clothes',
			},
			duelKills: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			monsterKills: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			itemsDropped: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			itemsEarned: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			itemsTraded: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			maxDamagedealt: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			expGained: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			npcInteractions: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			oresEarned: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			iuraEarned: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			iuraSpent: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			iuraTraded: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			memoriaEarned: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			linked: {
				type: DataTypes.BOOLEAN,
				defaultValue: 0,
			},
			walletAddress: DataTypes.TEXT,
			contractAddress: DataTypes.TEXT,
			tokenID: DataTypes.INTEGER,
			imageURL: DataTypes.TEXT,
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return Player;
};
