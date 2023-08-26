const { encrypt, decrypt } = require('../src/crypto-utils');

module.exports = (sequelize, DataTypes) => {
	const Guild = sequelize.define(
		'Guild',
		{
			guildID: DataTypes.TEXT,
			type: DataTypes.TEXT,
			verifyChannelID: DataTypes.TEXT,
			verifyMessageID: DataTypes.TEXT,
			verifyRoleID: DataTypes.TEXT,
			logsChannelID: DataTypes.TEXT,
			specialShopChannelID: DataTypes.TEXT,
			specialShopWebhookID: DataTypes.TEXT,
			specialShopWebhookToken: DataTypes.TEXT,
			twitterChannelID: DataTypes.TEXT,
			raidRoleID: DataTypes.TEXT,
			margarethaID: DataTypes.TEXT,
			margarethaName: DataTypes.TEXT,
			cerberonID: DataTypes.TEXT,
			cerberonName: DataTypes.TEXT,
			chatPrefix: DataTypes.TEXT,
			chatChannelID: DataTypes.TEXT,
			chatPrompt: DataTypes.TEXT,
			intro: DataTypes.TEXT,
			rules: DataTypes.TEXT,
			closing: DataTypes.TEXT,
			arenaBoss: DataTypes.BOOLEAN,
			customToken: DataTypes.TEXT,
			twitterID: {
				type: DataTypes.STRING,
				unique: true,
			},
			username: DataTypes.TEXT,
			accessToken: {
				type: DataTypes.TEXT,
				get() {
					const token = this.getDataValue('accessToken');
					return token ? decrypt(token) : null;
				},
				set(value) {
					this.setDataValue('accessToken', encrypt(value));
				},
			},
			refreshToken: {
				type: DataTypes.TEXT,
				get() {
					const token = this.getDataValue('refreshToken');
					return token ? decrypt(token) : null;
				},
				set(value) {
					this.setDataValue('refreshToken', encrypt(value));
				},
			},
			expiresIn: DataTypes.TEXT,
			expirationTime: DataTypes.DATE,
			walletAmount: {
				type: DataTypes.INTEGER,
				defaultValue: 500000,
			},
			subscription: {
				type: DataTypes.TEXT,
				defaultValue: 'free',
				validate: {
					isIn: [['free', 'premium', 'enterprise', 'megura']],
				},
			},
			webhookId: DataTypes.STRING,
			webhookToken: DataTypes.STRING,
			webhookChannelID: DataTypes.STRING,
			auctionChannelID: DataTypes.STRING,
			auctionwebhookId: DataTypes.STRING,
			auctionwebhookToken: DataTypes.STRING,
			brawlChannelID: DataTypes.STRING,
			brawlwebhookId: DataTypes.STRING,
			brawlwebhookToken: DataTypes.STRING,
		},
		{
			freezeTableName: true,
			timestamps: true,
		},
	);

	return Guild;
};
