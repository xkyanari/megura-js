module.exports = (sequelize, DataTypes) => {
    const Guild = sequelize.define('Guild', {
        guildID: {
            type: DataTypes.TEXT,
        },
        verifyChannelID: {
            type: DataTypes.TEXT,
        },
        logsChannelID: {
            type: DataTypes.TEXT,
        },
        whitelistChannelID: {
            type: DataTypes.TEXT,
        },
        twitterChannelID: {
            type: DataTypes.TEXT,
        },
        verifyRoleID: {
            type: DataTypes.TEXT,
        },
        raidRoleID: {
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