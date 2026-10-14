module.exports = (sequelize, DataTypes) => {
	// Points one player scored for their faction in a server in one week.
	const FactionContribution = sequelize.define(
		'FactionContribution',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			guildID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			accountID: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			// 'Margaretha' or 'Cerberon': kept per row, since a player can switch sides mid-week
			faction: {
				type: DataTypes.STRING(32),
				allowNull: false,
			},
			weekKey: {
				type: DataTypes.STRING(16),
				allowNull: false,
			},
			points: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ unique: true, fields: ['guildID', 'weekKey', 'accountID', 'faction'] }],
		},
	);

	return FactionContribution;
};
