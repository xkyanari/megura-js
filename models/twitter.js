module.exports = (sequelize, DataTypes) => {
    const Twitter = sequelize.define('Twitter', {
        discordID: {
            type: DataTypes.INTEGER,
            unique: true,
            primaryKey: true
        },
        twitterID: {
            type: DataTypes.TEXT,
        },
        username: {
            type: DataTypes.TEXT,
        },
        codeVerifier: {
            type: DataTypes.TEXT,
        },
        accessToken: {
            type: DataTypes.TEXT,
        },
        refreshToken: {
            type: DataTypes.TEXT,
        },
        expiresIn: {
            type: DataTypes.TEXT,
        },
        expirationTime: {
            type: DataTypes.DATE,
        },
    },
    {
        freezeTableName: true,
        timestamps: true
    });

    return Twitter;
};