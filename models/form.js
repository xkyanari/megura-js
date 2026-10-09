module.exports = (sequelize, DataTypes) => {
	const Form = sequelize.define(
		'Form',
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
			// shown as the pop-up's title, which Discord limits to 45 characters
			title: {
				type: DataTypes.STRING(45),
				allowNull: false,
			},
			description: DataTypes.STRING(1024),
			// where submissions are posted
			responseChannelID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			// where the form's button was last posted
			channelID: DataTypes.STRING,
			messageID: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ fields: ['guildID'] }],
		},
	);

	return Form;
};
