const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const { CaptchaGenerator } = require('captcha-canvas');
const crypto = require('node:crypto');
const { Guild } = require('../src/db');
const { uploadImage } = require('./upload');
const redis = require('../redis');

module.exports = async (interaction) => {
	const { guild, member } = interaction;

	try {
		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });

		if (!guildCheck || !guildCheck.verifyRoleID) {
			return interaction.reply({
				content: 'The "Verified" role does not exist. Please contact the guild admins.',
				ephemeral: true,
			});
		}

		const verifiedRole = member.roles.cache.get(guildCheck.verifyRoleID);
		if (verifiedRole) {
			return interaction.reply({
				content: 'You\'re already verified!',
				ephemeral: true,
			});
		}

		const captcha = new CaptchaGenerator()
			.setDimension(150, 450)
			.setDecoy({ opacity: 0.5 })
			.setTrace({ color: 'deeppink' });
		const buffer = captcha.generateSync();
		const flag = `captcha_${guild.id}_${member.id}_${Date.now()}`;
		const imageURL = await uploadImage(buffer, flag);
		const token = crypto.randomUUID();
		await redis.set(
			`captcha:${token}`,
			JSON.stringify({
				text: captcha.text,
				flag,
				guildID: guild.id,
				userID: member.id,
			}),
			'EX',
			180,
		);

		const embed = new EmbedBuilder()
			.setTitle('Verification')
			.setDescription('Please complete the CAPTCHA by clicking the button below and entering the code shown in the image. Don\'t worry about upper or lower case letters.')
			.setImage(imageURL);

		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`captcha-submit:${token}`)
				.setLabel('Enter Code')
				.setStyle(ButtonStyle.Primary),
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
