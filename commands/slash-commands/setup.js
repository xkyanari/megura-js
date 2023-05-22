const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, channelMention, roleMention } = require('discord.js');
const { Guild, Twitter } = require('../../src/db');
const captcha = require('../../functions/verify');
const { twitterAuth } = require('../../functions/twitter');
const rules = require('../../functions/rules');
const guild = require('../../models/guild');

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
            .setName('twitter')
            .setDescription('Login to Twitter.')
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('disable')
            .setDescription('Disable the setup.')
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
                .setDescription('Choose the channel to post the verification and rules message.')
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
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('rules')
            .setDescription('Setup rules for the server.')
            )
        .addSubcommand(subcommand =>
            subcommand
            .setName('settings')
            .setDescription('Show current server settings.')
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
                if (guildCheck) return await interaction.reply({ content: `Guild already registered.`, ephemeral: true});

                await Guild.create({ guildID: interaction.guild.id });
                await interaction.reply({ content: `Guild registered.`, ephemeral: true });
            break;

            case 'twitter':
                if (interaction.member.id !== interaction.guild.ownerId) return await interaction.reply({ content: `You do not have permission to perform this action.`, ephemeral: true });

                if (guildCheck.twitterID) {
                    return interaction.reply({ content: `Server logged in as \`${guildCheck.username}\`.`, ephemeral: true });
                } else {
                    await twitterAuth(interaction);
                }

                setTimeout(() => {
                    Twitter.findOne({ where: { discordID: interaction.member.id } })
                      .then((user) => {
                        if (user.username !== null) {
                          // Transfers the tokens to the Guild table
                          Guild.update({ twitterID: user.twitterID, username: user.username, accessToken: user.accessToken, refreshToken: user.refreshToken, expiresIn: user.expiresIn, expirationTime: user.expirationTime }, { where: { guildID: interaction.guild.id } })
                            .then(() => {
                              Twitter.destroy({ where: { discordID: interaction.member.id } })
                                .then(() => {
                                  return interaction.followUp({ content: `Tokens transferred to the Guild.\n\nServer now logged in as \`${user.username}\`.`, ephemeral: true });
                                })
                                .catch((error) => {
                                  console.error("Error clearing tokens in Twitter table:", error);
                                });
                            })
                            .catch((error) => {
                              console.error("Error transferring tokens to Guild table:", error);
                            });
                  
                        } else {
                          Twitter.destroy({ where: { discordID: interaction.member.id } });
                          Guild.update({ twitterID: '', username: '', accessToken: '', refreshToken: '', expiresIn: '', expirationTime: '' }, { where: { guildID: interaction.guild.id } });
                  
                          interaction.followUp({ content: `Session expired. Please try logging in again.`, ephemeral: true });
                        }
                      })
                      .catch((error) => {
                        console.error(error);
                      });
                  }, 180000);                  
            break;

            case 'disable':
                // Add a warning to confirm deletion of the guild entry.
                
                if (!guildCheck) return await interaction.reply({ content: `Dahlia is not yet setup in this server.`, ephemeral: true });
                await guildCheck.destroy({ where: { guildID: interaction.guild.id }});
                await interaction.reply({ content: `Guild has been un-registered.`, ephemeral: true });
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
            break;

            case 'factions':
                if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });

                const margaretha = options.getRole('margaretha');
                const cerberon = options.getRole('cerberon');

                await guildCheck.update({ margarethaID: margaretha.id, margarethaName: margaretha.name, cerberonID: cerberon.id, cerberonName: cerberon.name });
                await interaction.reply({ content: `Factions roles have been set successfully!`, ephemeral: true });
            break;

            case 'rules':
                try {
                    if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });

                    await rules(interaction);
                } catch (error) {
                    console.log(error);
                }
            break;

            case 'settings':
                if (!guildCheck) return await interaction.reply({ content: `Please register the guild first.`, ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle(`Current settings for ${interaction.guild.name}`);

                const fieldMap = [
                    { check: 'verifyChannelID', name: 'Verify Channel:', inline: true, valueFunc: channelMention },
                    { check: 'verifyRoleID', name: 'Verify Role:', inline: true, valueFunc: roleMention },
                    { check: 'twitterChannelID', name: 'Twitter Channel:', inline: true, valueFunc: channelMention },
                    { check: 'raidRoleID', name: 'Raid Role:', inline: true, valueFunc: roleMention },
                    { check: 'username', name: 'Server Twitter Account:', inline: false, valueFunc: (v) => `[@${v}](https://www.twitter.com/${v})` },
                    { check: 'logsChannelID', name: 'Audit Logs Channel:', inline: false, valueFunc: channelMention },
                    { check: 'whitelistChannelID', name: 'Whitelist Shop Channel:', inline: false, valueFunc: channelMention },
                ];

                const fields = fieldMap
                    .filter(field => guildCheck[field.check])
                    .map(field => ({ name: field.name, value: field.valueFunc(guildCheck[field.check]), inline: field.inline }));

                if (fields.length === 0) {
                    embed.addFields({name: `No settings found`, value: `Please configure your guild settings.`, inline: false })
                } else {
                    embed.addFields(...fields);
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
        }
	}
};