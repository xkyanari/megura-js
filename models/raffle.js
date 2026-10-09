module.exports = (sequelize, DataTypes) => {
	const Raffle = sequelize.define(
		'Raffle',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			channelID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			messageID: DataTypes.STRING,
			hostID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			prize: {
				type: DataTypes.STRING(256),
				allowNull: false,
			},
			winnerCount: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
			},
			// what tickets are paid with: IURA from the wallet, or ores (to the server's wallet)
			currency: {
				type: DataTypes.ENUM('iura', 'ores'),
				allowNull: false,
			},
			ticketPrice: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			maxTicketsPerUser: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			endsAt: {
				type: DataTypes.DATE,
				allowNull: false,
			},
			status: {
				type: DataTypes.ENUM('running', 'ended', 'cancelled'),
				allowNull: false,
				defaultValue: 'running',
			},
			// Discord user IDs of everyone who has won, including rerolls
			winners: {
				type: DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ fields: ['guildID', 'status'] }],
		},
	);

	return Raffle;
};
