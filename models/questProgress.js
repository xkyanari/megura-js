module.exports = (sequelize, DataTypes) => {
	// A player's progress on one quest objective in one day or week.
	const QuestProgress = sequelize.define(
		'QuestProgress',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			accountID: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			// 'd:2026-10-09' for a day, 'w:2026-W41' for a week (UTC)
			periodKey: {
				type: DataTypes.STRING(16),
				allowNull: false,
			},
			objective: {
				type: DataTypes.STRING(32),
				allowNull: false,
			},
			progress: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
			completed: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ unique: true, fields: ['accountID', 'periodKey', 'objective'] }],
		},
	);

	return QuestProgress;
};
