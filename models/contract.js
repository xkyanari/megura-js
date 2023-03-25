module.exports = (sequelize, DataTypes) => {
    const Contract = sequelize.define('Contract', {
        contractID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        blockchain: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        collectionID: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        contractName: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        contractAddress: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        traitWeapon: DataTypes.TEXT,
        traitArmor: DataTypes.TEXT,
        collectionURL: DataTypes.TEXT
    },
    {
        freezeTableName: true,
        timestamps: false
    });

    return Contract;
};