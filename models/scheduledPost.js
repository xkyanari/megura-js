module.exports = (sequelize, DataTypes) => {
	const ScheduledPost = sequelize.define(
		'ScheduledPost',
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
			channelID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			content: {
				type: DataTypes.STRING(2000),
				allowNull: false,
			},
			// exactly one of cron or intervalMinutes is set
			cron: DataTypes.STRING(100),
			timezone: DataTypes.STRING(64),
			intervalMinutes: DataTypes.INTEGER,
			createdBy: DataTypes.STRING,
			enabled: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			lastPostedAt: DataTypes.DATE,
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ fields: ['guildID'] }],
		},
	);

	return ScheduledPost;
};
