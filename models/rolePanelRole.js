module.exports = (sequelize, DataTypes) => {
	const RolePanelRole = sequelize.define(
		'RolePanelRole',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			panelId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			roleId: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			label: {
				type: DataTypes.STRING(80),
				allowNull: false,
			},
			emoji: DataTypes.STRING(100),
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ unique: true, fields: ['panelId', 'roleId'] }],
		},
	);

	return RolePanelRole;
};
