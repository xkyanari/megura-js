module.exports = (sequelize, DataTypes) => {
	// One row per auction that has been finalized (winner picked), so startup can
	// tell overdue auctions that never ended from ones that did.
	const AuctionClosure = sequelize.define(
		'AuctionClosure',
		{
			auctionId: {
				type: DataTypes.INTEGER,
				primaryKey: true,
			},
			closedAt: {
				type: DataTypes.DATE,
				allowNull: false,
			},
		},
		{
			freezeTableName: true,
			timestamps: false,
		},
	);

	return AuctionClosure;
};
