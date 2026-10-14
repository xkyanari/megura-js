module.exports = (sequelize, DataTypes) => {
	const RolePanel = sequelize.define(
		'RolePanel',
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
			title: {
				type: DataTypes.STRING(256),
				allowNull: false,
			},
			description: DataTypes.STRING(1024),
			// where the panel was last posted, so changes can update it
			channelID: DataTypes.STRING,
			messageID: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ fields: ['guildID'] }],
		},
	);

	return RolePanel;
};
