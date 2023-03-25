const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Initiate setup to your server!')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
            .setName('verify')
            .setDescription('Initiate verification.')
            .addChannelOption(option =>
                option
                .setName('channel')
                .setDescription('Choose the channel to post the verification message.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false))
            .addRoleOption(option =>
                option
                .setName('role')
                .setDescription('Select the role for verified users.')
                .setRequired(false))
            ),
    cooldown: 3000,
	async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        if (interaction.options.getSubcommand() === 'verify') {
            try {
                if (channel) {
                    await interaction.reply({ content: `Message sent!`, ephemeral: true });
                }
                if (role) {
                    await interaction.reply({ content: `Saved!`, ephemeral: true });
                }
            } catch (DiscordAPIError) {
                if (DiscordAPIError.code === 50001) return interaction.reply({ content: `I don't seem to have access to send a message in that channel. Is there a mistake?`, ephemeral: true });
            }
        }
	}
};