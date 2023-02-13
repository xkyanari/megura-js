module.exports = (sequelize, DataTypes) => {
    const Monster = sequelize.define('Monster', {
        monsterID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        monsterName: DataTypes.TEXT,
        location: DataTypes.TEXT,
        faction: DataTypes.TEXT,
        level: DataTypes.INTEGER,
        totalHealth: DataTypes.INTEGER,
        totalAttack: DataTypes.INTEGER,
        totalDefense: DataTypes.INTEGER,
        expDropped: DataTypes.INTEGER,
        iuraDropped: DataTypes.INTEGER,
    },
    {
        freezeTableName: true,
        timestamps: false
    });
    return Monster;
};