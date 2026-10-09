module.exports = (sequelize, DataTypes) => {
	// A settled faction week in a server: who won, and who was rewarded.
	const FactionSeason = sequelize.define(
		'FactionSeason',
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
			weekKey: {
				type: DataTypes.STRING(16),
				allowNull: false,
			},
			// null for a tie or a week nobody scored in
			winner: DataTypes.STRING(32),
			scores: {
				type: DataTypes.JSON,
				allowNull: false,
				defaultValue: {},
			},
			// Discord user IDs of the rewarded players (they hold the champion role until the next season)
			rewardedIDs: {
				type: DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			// [{ discordID, points, iura }], for the announcement
			rewards: {
				type: DataTypes.JSON,
				allowNull: false,
				defaultValue: [],
			},
			// whether the announcement and role changes went through (retried until they do)
			delivered: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ unique: true, fields: ['guildID', 'weekKey'] }],
		},
	);

	return FactionSeason;
};
