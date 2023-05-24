const { encrypt, decrypt } = require("../src/crypto-utils");

module.exports = (sequelize, DataTypes) => {
  const Twitter = sequelize.define(
    "Twitter",
    {
      discordID: {
        type: DataTypes.TEXT,
        unique: true,
      },
      twitterID: {
        type: DataTypes.TEXT,
        unique: true,
      },
      username: {
        type: DataTypes.TEXT,
      },
      codeVerifier: {
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
    },
    {
      freezeTableName: true,
      timestamps: true,
    }
  );

  return Twitter;
};
