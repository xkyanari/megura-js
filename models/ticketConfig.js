module.exports = (sequelize, DataTypes) => {
	const TicketConfig = sequelize.define(
		'TicketConfig',
		{
			guildID: {
				type: DataTypes.STRING,
				primaryKey: true,
			},
			staffRoleID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			// category new ticket channels go in; null puts them at the top of the server
			categoryID: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return TicketConfig;
};
