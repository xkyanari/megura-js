module.exports = (sequelize, DataTypes) => {
	const Order = sequelize.define(
		'Order',
		{
			orderID: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			discordID: DataTypes.STRING,
			guildID: DataTypes.TEXT,
			item_ID: DataTypes.STRING,
			itemName: DataTypes.STRING,
			status: {
				type: DataTypes.STRING,
				allowNull: false,
				defaultValue: 'pending',
			},
			messageID: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: false,
		},
	);

	return Order;
};