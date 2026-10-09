const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require('discord.js');
const { CaptchaGenerator } = require('captcha-canvas');
const crypto = require('node:crypto');
const { Guild } = require('../src/db');
const { uploadImage, deleteImage } = require('./upload');
const redis = require('../redis');

const CAPTCHA_SECONDS = 180;
// Uploaded captcha images, scored by when they expire, so abandoned ones get deleted.
const IMAGES_KEY = 'captcha:images';

const trackImage = (flag) => redis.zadd(IMAGES_KEY, Date.now() + CAPTCHA_SECONDS * 1000, flag);

// Deletes images whose captcha expired unanswered. Runs whenever a new captcha is made.
const sweepExpiredImages = async (now = Date.now()) => {
	const expired = await redis.zrangebyscore(IMAGES_KEY, 0, now);
	if (!expired.length) return 0;
	await redis.zrem(IMAGES_KEY, ...expired);
	await Promise.all(expired.map((flag) => deleteImage(flag)));
	return expired.length;
};

// Deletes an image now (answered or failed) and stops tracking it.
const discardImage = async (flag) => {
	if (!flag) return;
	await redis.zrem(IMAGES_KEY, flag);
	await deleteImage(flag);
};

const showCaptcha = async (interaction) => {
	const { guild, member } = interaction;

	const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });

	if (!guildCheck || !guildCheck.verifyRoleID) {
		return interaction.reply({
			content: 'The "Verified" role does not exist. Please contact the guild admins.',
			flags: 64,
		});
	}

	const verifiedRole = member.roles.cache.get(guildCheck.verifyRoleID);
	if (verifiedRole) {
		return interaction.reply({
			content: 'You\'re already verified!',
			flags: 64,
		});
	}

	// generating and uploading the image can take longer than Discord's 3 seconds
	await interaction.deferReply({ flags: 64 });
	await sweepExpiredImages().catch((error) => console.error('Could not clean up captcha images:', error));

	const captcha = new CaptchaGenerator()
		.setDimension(150, 450)
		.setDecoy({ opacity: 0.5 })
		.setTrace({ color: 'deeppink' });
	const buffer = captcha.generateSync();
	const flag = `captcha_${guild.id}_${member.id}_${Date.now()}`;
	const imageURL = await uploadImage(buffer, flag);
	await trackImage(flag);
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
		CAPTCHA_SECONDS,
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

	await interaction.editReply({ embeds: [embed], components: [button] });
};

module.exports = showCaptcha;
module.exports.sweepExpiredImages = sweepExpiredImages;
module.exports.discardImage = discardImage;
