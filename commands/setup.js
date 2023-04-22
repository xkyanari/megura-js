const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const { Guild } = require('../src/db');
const captcha = require('../functions/verify');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Initiate setup to your server!')
        .setDefaultMemberPermissions('0')
        .addSubcommand(subcommand =>
            subcommand
            .setName('register')
            .setDescription('Register guild.')
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('disable')
            .setDescription('Disable the verification.')
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('logs')
            .setDescription('Assign channel for audit logs.')
            .addChannelOption(option =>
                option
                .setName('channel')
                .setDescription('Choose the channel to log captcha attempts.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('captcha')
            .setDescription('Setup CAPTCHA.')
            .addChannelOption(option =>
                option
                .setName('channel')
                .setDescription('Choose the channel to post the verification message.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
            .addRoleOption(option =>
                option
                .setName('role')
                .setDescription('Select the role for verified users.')
                .setRequired(true))
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('shop')
            .setDescription('Whitelist Shop.')
            .addChannelOption(option =>
                option
                .setName('channel')
                .setDescription('Choose the channel for the Whitelist Shop.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('deploy')
            .setDescription('Deploy messages for respective channels.')
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('factions')
            .setDescription('Assign factions.')
            .addRoleOption(option =>
                option
                .setName('margaretha')
                .setDescription('Select the role for Margaretha faction.')
                .setRequired(true))
            .addRoleOption(option =>
                option
                .setName('cerberon')
                .setDescription('Select the role for Cerberon faction.')
                .setRequired(true))
            ),
    cooldown: 3000,
	async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return await interaction.reply({
            content: `You do not have permissions to setup the server.`,
            ephemeral: true
        });

        const guildCheck = await Guild.findOne({ where: {guildID: interaction.guild.id} });

        const { options } = interaction;
        const subCommand = options.getSubcommand();

        switch (subCommand) {
            case 'register':
                await Guild.create({ guildID: interaction.guild.id });
                await interaction.reply({ content: `Guild registered.`, ephemeral: true });
            break;

            case 'disable':
                if (!guildCheck) return await interaction.reply({ content: `Dahlia is not yet setup in this server.`, ephemeral: true });
                await guildCheck.destroy({ where: { guildID: interaction.guild.id }});
                await interaction.reply({ content: `Verification disabled!`, ephemeral: true });
            break;

            case 'logs':
                if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });

                const logsChannel = options.getChannel('channel');
                
                await guildCheck.update({ logsChannelID: logsChannel.id });
                await interaction.reply({ content: `Audit Logs channel assigned.`, ephemeral: true });
            break;

            case 'captcha':
                try {
                    if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });

                    const verifyChannel = options.getChannel('channel');
                    const role = options.getRole('role');
                    
                    await guildCheck.update({ verifyChannelID: verifyChannel.id, verifyRoleID: role.id });
                    await interaction.reply({ content: `Captcha settings saved!`, ephemeral: true });
                } catch (error) {
                    console.log(error);
                }
            break;

            case 'shop':
                if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });
                
                const whitelist = options.getChannel('channel');

                await guildCheck.update({ whitelistChannelID: whitelist.id });
                await interaction.reply({ content: `Verification disabled!`, ephemeral: true });
            break;

            case 'deploy':
                if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });
                await captcha(interaction, guildCheck.verifyChannelID);
                await interaction.reply({ content: `Captcha Verification has been deployed!`, ephemeral: true });
            break;

            case 'factions':
                if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });

                const margaretha = options.getRole('margaretha');
                const cerberon = options.getRole('cerberon');

                await guildCheck.update({ margarethaID: margaretha.id, margarethaName: margaretha.name, cerberonID: cerberon.id, cerberonName: cerberon.name });
                await interaction.reply({ content: `Factions roles have been set successfully!`, ephemeral: true });
            break;

        }
	}
};