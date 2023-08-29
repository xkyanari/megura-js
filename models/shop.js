module.exports = (sequelize, DataTypes) => {
	const Shop = sequelize.define(
		'Shop',
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
				defaultValue: 1,
				allowNull: false,
			},
			level: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			category: {
				type: DataTypes.TEXT,
			},
			totalHealth: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			totalAttack: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			totalDefense: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			price: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
				allowNull: false,
			},
			description: DataTypes.TEXT,
			item_ID: DataTypes.TEXT,
			guildID: DataTypes.TEXT,
		},
		{
			freezeTableName: true,
			timestamps: false,
		},
	);

	return Shop;
};
