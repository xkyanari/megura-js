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
				'Dahlia uses data provided through slash commands, buttons, menus, and modals to run server tools and game features. Dahlia does not request privileged Message Content, Server Members, or Presence intents.',
			)
			.addFields(
				{
					name: 'Player and Game Data',
					value: 'When users play, Dahlia stores Discord user IDs, guild IDs, player names, profile stats, level/experience, inventory, shop purchases, wallet/game balances, battle/duel/brawl results, auction activity, and related timestamps as needed for gameplay.',
				},
				{
					name: 'Server Configuration',
					value: 'Server setup can store guild IDs, channel IDs, role IDs, feature settings, webhook settings, and configured log channel settings.',
				},
				{
					name: 'Message Content',
					value: 'Dahlia does not collect normal channel message text for commands, AI chat, or deleted-message logging.',
				},
				{
					name: 'Retention',
					value: 'Local log files are automatically removed after 30 days. Server admins can disable setup data with `/setup disable` where supported.',
				},
				{
					name: 'Opt-Out',
					value: 'Users can stop creating new player/activity data by not using gameplay commands. For deletion requests, contact the support server listed in `/support` with your Discord ID and server/guild ID.',
				},
			);

		await interaction.reply({ embeds: [embed] });
	},
};
