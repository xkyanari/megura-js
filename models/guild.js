module.exports = (sequelize, DataTypes) => {
    const Guild = sequelize.define('Guild', {
        guildID: {
            type: DataTypes.TEXT,
        },
        verifyChannelID: {
            type: DataTypes.TEXT,
        },
        verifyRoleID: {
            type: DataTypes.TEXT,
        },
        margarethaID: {
            type: DataTypes.TEXT,
        },
        margarethaName: {
            type: DataTypes.TEXT,
        },
        cerberonID: {
            type: DataTypes.TEXT,
        },
        cerberonName: {
            type: DataTypes.TEXT,
        },
    },
    {
        freezeTableName: true,
        timestamps: true
    });

    return Guild;
};