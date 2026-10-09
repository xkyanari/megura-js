module.exports = (sequelize, DataTypes) => {
	const GiveawayEntry = sequelize.define(
		'GiveawayEntry',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			giveawayId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			userId: {
				type: DataTypes.STRING,
				allowNull: false,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			// one entry per member per giveaway, even under double clicks
			indexes: [{ unique: true, fields: ['giveawayId', 'userId'] }],
		},
	);

	return GiveawayEntry;
};
