module.exports = (sequelize, DataTypes) => {
  const Quest = sequelize.define(
    "Quest",
    {
      questID: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      questName: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      questDescription: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      questReward: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      freezeTableName: true,
      timestamps: false,
    }
  );

  return Quest;
};
