module.exports = (sequelize, DataTypes) => {
	const Auction = sequelize.define(
		'Auction',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			userID: DataTypes.STRING,
			guildID: DataTypes.STRING,
			itemId: {
				type: DataTypes.INTEGER,
				references: {
					model: 'AuctionItem',
					key: 'id',
				},
			},
			startDateTime: DataTypes.DATE,
			endDateTime: DataTypes.DATE,
			// satoshis: BIGINT, since FLOAT rounds amounts above about 0.17 coin
			startPrice: DataTypes.BIGINT,
			// satoshis: BIGINT, since FLOAT rounds amounts above about 0.17 coin
			currentPrice: DataTypes.BIGINT,
			// satoshis: BIGINT, since FLOAT rounds amounts above about 0.17 coin
			increment: DataTypes.BIGINT,
			winnerId: {
				type: DataTypes.STRING,
				references: {
					model: 'User',
					key: 'userGuildId',
				},
			},
			messageID: DataTypes.STRING,
			attachmentURL: DataTypes.STRING,
			version: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return Auction;
};
