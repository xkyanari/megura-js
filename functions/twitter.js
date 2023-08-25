const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');
const {
	isTestnet,
	website,
	website_testnet,
} = require('../config.json');
const { Twitter } = require('../src/db');
const { generateId } = require('./generateId');

/**
 *
 * According to https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 * By default, the access token you create through the Authorization Code Flow with PKCE
 * will only stay valid for two hours unless you’ve used the offline.access scope.
 *
 */

const twitterAuth = async (interaction) => {
	try {
		const twitter = await Twitter.findOne({
			where: { discordID: interaction.member.id },
		});

		const registrationID = await generateId(10);
		const registrationURL = isTestnet ? `${website_testnet}/connect/service/twitter?id=${registrationID}` : `${website}/connect/service/twitter?id=${registrationID}`;

		if (twitter) {
			twitter.registrationID = registrationID;
			await twitter.save();
		}
		else {
			await Twitter.create({ discordID: interaction.member.id, registrationID });
		}

		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setLabel('Login')
				.setEmoji('🐦')
				.setStyle(ButtonStyle.Link)
				.setURL(registrationURL),
		);

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setDescription(
				`Please click the button below to authenticate with your Twitter account.
                
                Once authenticated, please allow up to 2 mins to check your status.`,
			);
		await interaction.reply({
			embeds: [embed],
			components: [button],
			ephemeral: true,
		});
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = {
	twitterAuth,
};
