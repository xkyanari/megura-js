module.exports = (sequelize, DataTypes) => {
    const Raid = sequelize.define('Raid', {
        tweetID: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        tweetUrlID: {
            type: DataTypes.TEXT,
        },
        postedBy: {
            type: DataTypes.INTEGER,
        },
        postedIn: {
            type: DataTypes.INTEGER,
        },
        retweeters: {
            type: DataTypes.TEXT,
            defaultValue: '[]',
            get() {
              return JSON.parse(this.getDataValue('retweeters'));
            },
            set(value) {
              this.setDataValue('retweeters', JSON.stringify(value));
            },
        },
        likers: {
            type: DataTypes.TEXT,
            defaultValue: '[]',
            get() {
                return JSON.parse(this.getDataValue('likers'));
            },
            set(value) {
                this.setDataValue('likers', JSON.stringify(value));
            },
        },
    },
    {
        freezeTableName: true,
        timestamps: true
    });

    return Raid;
};