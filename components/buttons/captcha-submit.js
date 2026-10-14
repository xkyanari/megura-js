const {
	ModalBuilder,
	ActionRowBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');

module.exports = {
	data: {
		name: 'captcha-submit',
	},
	async execute(interaction) {
		const [, token] = interaction.customId.split(':');

		const modal = new ModalBuilder()
			.setCustomId(`captcha:${token}`)
			.setTitle('CAPTCHA Verification');

		const captchaCode = new TextInputBuilder()
			.setCustomId('captchaCode')
			.setLabel('Enter the CAPTCHA code')
			.setStyle(TextInputStyle.Short)
			.setMinLength(1)
			.setMaxLength(12)
			.setRequired(true);

		modal.addComponents(
			new ActionRowBuilder().addComponents(captchaCode),
		);

		await interaction.showModal(modal);
	},
};
