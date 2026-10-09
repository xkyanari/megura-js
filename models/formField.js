module.exports = (sequelize, DataTypes) => {
	const FormField = sequelize.define(
		'FormField',
		{
			id: {
				type: DataTypes.INTEGER,
				autoIncrement: true,
				primaryKey: true,
			},
			formId: {
				type: DataTypes.INTEGER,
				allowNull: false,
			},
			label: {
				type: DataTypes.STRING(45),
				allowNull: false,
			},
			style: {
				type: DataTypes.ENUM('short', 'paragraph'),
				allowNull: false,
				defaultValue: 'short',
			},
			required: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			placeholder: DataTypes.STRING(100),
		},
		{
			freezeTableName: true,
			timestamps: true,
			indexes: [{ fields: ['formId'] }],
		},
	);

	return FormField;
};
