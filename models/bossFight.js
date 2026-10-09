module.exports = (sequelize, DataTypes) => {
	const BossFight = sequelize.define(
		'BossFight',
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
			// 'solo': one player's challenge; 'group': a world boss anyone in the channel can join
			kind: {
				type: DataTypes.ENUM('solo', 'group'),
				allowNull: false,
			},
			// the challenger, for solo fights
			discordID: DataTypes.STRING,
			monsterName: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			status: {
				type: DataTypes.ENUM('running', 'won', 'lost', 'interrupted'),
				allowNull: false,
				defaultValue: 'running',
			},
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ fields: ['guildID', 'status'] }],
		},
	);

	return BossFight;
};
