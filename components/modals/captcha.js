const { Guild } = require('../../src/db');
const { deleteImage } = require('../../functions/upload');
const redis = require('../../redis');

module.exports = {
	data: {
		name: 'captcha',
	},
	async execute(interaction) {
		const [, token] = interaction.customId.split(':');
		const captchaCode = interaction.fields.getTextInputValue('captchaCode').trim();
		const captchaData = await redis.get(`captcha:${token}`);

		if (!captchaData) {
			return interaction.reply({
				content: 'This CAPTCHA has expired. Please click Verify and try again.',
				flags: 64,
			});
		}

		const { text, flag, guildID, userID } = JSON.parse(captchaData);

		if (interaction.guild.id !== guildID || interaction.member.id !== userID) {
			return interaction.reply({
				content: 'This CAPTCHA was created for a different user or server.',
				flags: 64,
			});
		}

		if (captchaCode.toLowerCase() !== text.toLowerCase()) {
			return interaction.reply({
				content: 'The captcha code you entered is incorrect. Please try again.',
				flags: 64,
			});
		}

		const guildCheck = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});

		if (!guildCheck || !guildCheck.verifyRoleID) {
			return interaction.reply({
				content: 'The "Verified" role does not exist. Please contact the guild admins.',
				flags: 64,
			});
		}

		const addRole = interaction.guild.roles.cache.get(guildCheck.verifyRoleID);
		if (!addRole) {
			return interaction.reply({
				content: 'The "Verified" role could not be found. Please contact the guild admins.',
				flags: 64,
			});
		}

		await interaction.member.roles.add(addRole);
		if (flag) await deleteImage(flag);
		await redis.del(`captcha:${token}`);

		await interaction.reply({
			content: 'You have been successfully verified!',
			flags: 64,
		});
	},
};
