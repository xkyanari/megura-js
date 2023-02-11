module.exports = (sequelize, DataTypes) => {
    const Item = sequelize.define('Item', {
        itemName: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        level: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        totalHealth: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        totalAttack: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        totalDefense: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        price: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
    },
    {
        freezeTableName: true,
        timestamps: false
    });

    return Item;
};