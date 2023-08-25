module.exports = (sequelize, DataTypes) => {
	const Brawl = sequelize.define(
		'Brawl',
		{
			listingId: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			challengerId: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			acceptorId: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			wager: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			status: {
				type: DataTypes.ENUM('pending', 'completed', 'expired'),
				defaultValue: 'pending',
			},
			outcome: {
				type: DataTypes.ENUM('challenger_win', 'acceptor_win', 'draw'),
				allowNull: true,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return Brawl;
};
