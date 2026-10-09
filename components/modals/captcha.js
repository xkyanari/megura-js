const { Guild } = require('../../src/db');
const { discardImage } = require('../../functions/captcha');
const redis = require('../../redis');

module.exports = {
	data: {
		name: 'captcha',
	},
	async execute(interaction) {
		const [, token] = interaction.customId.split(':');
		const captchaCode = interaction.fields.getTextInputValue('captchaCode').trim();
		// one answer per captcha: taking it out of Redis means a wrong guess can't be retried
		const captchaData = await redis.getdel(`captcha:${token}`);

		if (!captchaData) {
			return interaction.reply({
				content: 'This CAPTCHA has expired. Please click Verify and try again.',
				flags: 64,
			});
		}

		const { text, flag, guildID, userID } = JSON.parse(captchaData);

		if (interaction.guild.id !== guildID || interaction.member.id !== userID) {
			// not this member's to answer: put it back for its owner
			await redis.set(`captcha:${token}`, captchaData, 'KEEPTTL');
			return interaction.reply({
				content: 'This CAPTCHA was created for a different user or server.',
				flags: 64,
			});
		}

		await discardImage(flag);

		if (captchaCode.toLowerCase() !== text.toLowerCase()) {
			return interaction.reply({
				content: 'The captcha code you entered is incorrect. Please click Verify to get a new one.',
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

		await interaction.reply({
			content: 'You have been successfully verified!',
			flags: 64,
		});
	},
};
