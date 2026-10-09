module.exports = (sequelize, DataTypes) => {
	// Where a server announces faction seasons, and its optional champion role.
	const FactionConfig = sequelize.define(
		'FactionConfig',
		{
			guildID: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			channelID: DataTypes.STRING,
			roleID: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return FactionConfig;
};
