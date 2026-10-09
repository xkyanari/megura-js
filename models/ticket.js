module.exports = (sequelize, DataTypes) => {
	const Ticket = sequelize.define(
		'Ticket',
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
			channelID: DataTypes.STRING,
			openerID: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			status: {
				type: DataTypes.ENUM('open', 'closed'),
				allowNull: false,
				defaultValue: 'open',
			},
			// 'open' while the ticket is open, null once closed. With the unique
			// index below this allows one open ticket per member, even if they
			// double-click (MySQL lets any number of rows share a NULL).
			openSlot: {
				type: DataTypes.STRING(8),
				defaultValue: 'open',
			},
			closedBy: DataTypes.STRING,
			closedAt: DataTypes.DATE,
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [
				{ unique: true, fields: ['guildID', 'openerID', 'openSlot'] },
				{ fields: ['channelID'] },
			],
		},
	);

	return Ticket;
};
