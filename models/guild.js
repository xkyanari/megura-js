const { encrypt, decrypt } = require("../src/crypto-utils");

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
        intro: {
            type: DataTypes.TEXT,
        },
        rules: {
            type: DataTypes.TEXT,
        },
        closing: {
            type: DataTypes.TEXT,
        },
        twitterID: {
            type: DataTypes.TEXT,
            unique: true,
        },
        username: {
            type: DataTypes.TEXT,
        },
        accessToken: {
            type: DataTypes.TEXT,
            get() {
                const token = this.getDataValue("accessToken");
                return token ? decrypt(token) : null;
            },
            set(value) {
                this.setDataValue("accessToken", encrypt(value));
            },
        },
        refreshToken: {
            type: DataTypes.TEXT,
            get() {
                const token = this.getDataValue("refreshToken");
                return token ? decrypt(token) : null;
            },
            set(value) {
                this.setDataValue("refreshToken", encrypt(value));
            },
        },
        expiresIn: {
            type: DataTypes.TEXT,
        },
        expirationTime: {
            type: DataTypes.DATE,
        },
        walletAmount: {
            type: DataTypes.INTEGER,
            defaultValue: 1000000
        },
    },
    {
        freezeTableName: true,
        timestamps: true
    });

    return Guild;
};