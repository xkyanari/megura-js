module.exports = (sequelize, DataTypes) => {
    const Contract = sequelize.define('Contract', {
        contractID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        contractName: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        contractAddress: {
            type: DataTypes.TEXT,
            allowNull: false
        },
    },
    {
        freezeTableName: true,
        timestamps: false
    });

    return Contract;
};