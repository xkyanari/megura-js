module.exports = (sequelize, DataTypes) => {
	const Bid = sequelize.define(
		'Bid',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			auctionId: {
				type: DataTypes.INTEGER,
				references: {
					model: 'Auction',
					key: 'id',
				},
			},
			userId: {
				type: DataTypes.STRING,
				references: {
					model: 'User',
					key: 'userGuildId',
				},
			},
			// satoshis: BIGINT, since FLOAT rounds amounts above about 0.17 coin
			bidAmount: DataTypes.BIGINT,
			bidDateTime: DataTypes.DATE,
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return Bid;
};
