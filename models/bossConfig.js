module.exports = (sequelize, DataTypes) => {
	// Random world boss spawns for a server: where, and about how often.
	const BossConfig = sequelize.define(
		'BossConfig',
		{
			guildID: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			channelID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			intervalHours: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return BossConfig;
};
