module.exports = (sequelize, DataTypes) => {
	const RaffleTicket = sequelize.define(
		'RaffleTicket',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			raffleId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			userId: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			// tickets this member holds; their chance to win is proportional to it
			count: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ unique: true, fields: ['raffleId', 'userId'] }],
		},
	);

	return RaffleTicket;
};
