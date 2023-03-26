const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { Guild } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Initiate setup to your server!')
        .setDefaultMemberPermissions('0')
        .addSubcommand(subcommand =>
            subcommand
            .setName('register')
            .setDescription('Register guild (for demonstration purposes only).')
            )
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
            .addRoleOption(option =>
                option
                .setName('margaretha')
                .setDescription('Select the role for Margaretha faction.')
                .setRequired(false))
            .addRoleOption(option =>
                option
                .setName('cerberon')
                .setDescription('Select the role for Cerberon faction.')
                .setRequired(false))
            ),
    cooldown: 3000,
	async execute(interaction) {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');
        const margaretha = interaction.options.getRole('margaretha');
        const cerberon = interaction.options.getRole('cerberon');

        const guildCheck = await Guild.findOne({ where: {guildID: interaction.guild.id} });

        if (interaction.options.getSubcommand() === 'register') {
            if (!guildCheck) await Guild.create({ guildID: interaction.guild.id });
            await interaction.reply({ content: `Guild registered.`, ephemeral: true });
        }

        if (interaction.options.getSubcommand() === 'verify') {
            try {

                if (channel) {
                    await guildCheck.update({ verifyChannelID: channel.id });
                    await interaction.reply({ content: `Verify Channel saved!`, ephemeral: true });
                }

                if (role) {
                    await guildCheck.update({ verifyRoleID: role.id });
                    await interaction.reply({ content: `Verified Role saved!`, ephemeral: true });
                }

                if (margaretha) {
                    await guildCheck.update({ margarethaID: margaretha.id, margarethaName: margaretha.name });
                    await interaction.reply({ content: `Margaretha Role saved!`, ephemeral: true });
                }

                if (cerberon) {
                    await guildCheck.update({ cerberonID: cerberon.id, cerberonName: cerberon.name });
                    await interaction.reply({ content: `Cerberon Role saved!`, ephemeral: true });
                }

            } catch (error) {
                if (error.code === 50001) return interaction.reply({ content: `I don't seem to have sufficient. Is there a mistake?`, ephemeral: true });
                else {
                    console.log(error);
                }
            }
        }
	}
};