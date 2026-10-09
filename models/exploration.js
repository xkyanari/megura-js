module.exports = (sequelize, DataTypes) => {
	// Where a player is exploring, and every location they have found.
	const Exploration = sequelize.define(
		'Exploration',
		{
			accountID: {
				type: DataTypes.INTEGER,
				primaryKey: true,
			},
			location: {
				type: DataTypes.STRING(64),
				allowNull: false,
			},
			discovered: {
				type: DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			searches: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return Exploration;
};
