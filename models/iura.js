module.exports = (sequelize, DataTypes) => {
    const Iura = sequelize.define('Iura', {
        accountID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        walletName: {
            type: DataTypes.TEXT,
            unique: true
        },
        walletAmount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        bankName: {
            type: DataTypes.TEXT,
            unique: true
        },
        bankAmount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        stakedAmount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        }
    },
    {
        freezeTableName: true,
        timestamps: true,
    });

    return Iura;
};