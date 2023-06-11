module.exports = (sequelize, DataTypes) => {
	const Item = sequelize.define(
		'Item',
		{
			itemID: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			itemName: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			quantity: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			equipped: {
				type: DataTypes.BOOLEAN,
				defaultValue: 0,
			},
			equippedAmount: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			createdAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			updatedAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
		},
		{
			freezeTableName: true,
		},
	);

	return Item;
};
