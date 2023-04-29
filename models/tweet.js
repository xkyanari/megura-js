module.exports = (sequelize, DataTypes) => {
    const Tweet = sequelize.define('Tweet', {
        postedby: {
            type: DataTypes.TEXT,
        },
        tweetID: {
            type: DataTypes.TEXT,
        },
        tweetURL: {
            type: DataTypes.TEXT,
        },
    },
    {
      freezeTableName: true,
      timestamps: true
    });
  
    return Tweet;
  };
  