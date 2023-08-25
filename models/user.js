module.exports = (sequelize, DataTypes) => {
	const User = sequelize.define(
		'User',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			registrationID: DataTypes.STRING,
			discordID: {
				type: DataTypes.STRING,
			},
			guildID: {
				type: DataTypes.STRING,
			},
			userGuildId: {
				type: DataTypes.STRING,
				unique: true,
			},
			type: DataTypes.STRING,
			walletAddress: {
				type: DataTypes.STRING,
			},
			publicKey: {
				type: DataTypes.STRING,
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return User;
};
