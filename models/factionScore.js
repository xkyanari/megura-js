module.exports = (sequelize, DataTypes) => {
	// Rival monsters a faction's members defeated in a server in one week.
	const FactionScore = sequelize.define(
		'FactionScore',
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
			// 'Margaretha' or 'Cerberon'
			faction: {
				type: DataTypes.STRING(32),
				allowNull: false,
			},
			// 'w:2026-W41' (UTC)
			weekKey: {
				type: DataTypes.STRING(16),
				allowNull: false,
			},
			score: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ unique: true, fields: ['guildID', 'faction', 'weekKey'] }],
		},
	);

	return FactionScore;
};
