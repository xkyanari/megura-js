module.exports = (sequelize, DataTypes) => {
	const AuctionItem = sequelize.define(
		'AuctionItem',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			itemName: DataTypes.STRING,
			quantity: DataTypes.INTEGER,
            description: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return AuctionItem;
};
