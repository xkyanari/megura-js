module.exports = (sequelize, DataTypes) => {
	// A chapter played in a server with /story.
	const StoryProgress = sequelize.define(
		'StoryProgress',
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
			chapter: {
				type: DataTypes.STRING(128),
				allowNull: false,
			},
			// Discord user ID of the moderator who played it
			playedBy: DataTypes.STRING,
			playedAt: {
				type: DataTypes.DATE,
				allowNull: false,
			},
		},
		{
			freezeTableName: true,
			timestamps: false,
			indexes: [{ fields: ['guildID'] }],
		},
	);

	return StoryProgress;
};
