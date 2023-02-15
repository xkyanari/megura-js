module.exports = (sequelize, DataTypes) => {
    const Item = sequelize.define('Item', {
        itemID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        itemName: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
    },
    {
        freezeTableName: true,
        timestamps: false
    });

    return Item;
};