const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('privacy')
		.setDescription('Show how Dahlia uses Discord data.'),
	cooldown: 3000,
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setTitle('Privacy Notice')
			.setColor(0xcd7f32)
			.setDescription(
				'Dahlia reads message content when users run text commands, speak to the bot using the configured chat prefix, use verification/captcha channels, or when moderation logs are enabled. Message content is not used to train machine learning or AI models.',
			)
			.addFields(
				{
					name: 'Message Content',
					value: 'Conversation messages may be sent to OpenAI only to generate the bot response. Deleted messages may be posted to the configured server log channel and written to local daily log files for moderation transparency.',
				},
				{
					name: 'Member Data',
					value: 'Dahlia uses member data to verify users, manage roles, show profiles, run RPG features, and write join/leave moderation logs.',
				},
				{
					name: 'Retention',
					value: 'Local moderation log files are automatically removed after 30 days. Server admins can disable setup data with `/setup disable`.',
				},
				{
					name: 'Opt-Out',
					value: 'Users can stop AI chat by sending the configured chat prefix followed by `stop`. Message content processing cannot be disabled per user while using text commands, verification channels, moderation logging, or AI chat features.',
				},
			);

		await interaction.reply({ embeds: [embed] });
	},
};
