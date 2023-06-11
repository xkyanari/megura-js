const {
	SlashCommandBuilder,
	ChannelType,
	PermissionsBitField,
	EmbedBuilder,
	channelMention,
	roleMention,
} = require('discord.js');
const { Guild, Twitter } = require('../../src/db');
const captcha = require('../../functions/verify');
const { twitterAuth } = require('../../functions/twitter');
const rules = require('../../functions/rules');
const logger = require('../../src/logger');
const { validateFeature } = require('../../src/feature');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Initiate setup to your server!')
		.setDefaultMemberPermissions('0')
		.addSubcommand((subcommand) =>
			subcommand.setName('register').setDescription('Register guild.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('twitter').setDescription('Login to Twitter.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('disable').setDescription('Disable the setup.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('logs')
				.setDescription('Assign channel for audit logs.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Choose the channel to log captcha attempts.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('captcha')
				.setDescription('Setup CAPTCHA.')
				.addStringOption(option =>
					option.setName('type')
						.setDescription('Choose whether to use CAPTCHA or add role automatically after a button click.')
						.setRequired(true)
						.addChoices(
							{ name: 'Button', value: 'button' },
							{ name: 'CAPTCHA', value: 'captcha' },
						),
				)
				.addRoleOption((option) =>
					option
						.setName('role')
						.setDescription('Select the role for verified users.')
						.setRequired(true),
				)
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription(
							'Choose the channel to post the verification and rules message.',
						)
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('shop')
				.setDescription('Whitelist Shop.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Choose the channel for the Whitelist Shop.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('deploy').setDescription('Deploy messages for respective channels.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('factions')
				.setDescription('Assign factions.')
				.addRoleOption((option) =>
					option
						.setName('margaretha')
						.setDescription('Select the role for Margaretha faction.')
						.setRequired(true),
				)
				.addRoleOption((option) =>
					option
						.setName('cerberon')
						.setDescription('Select the role for Cerberon faction.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('chat')
				.setDescription('Adjust chat settings for Dahlia.')
				.addBooleanOption((option) =>
					option
						.setName('disable')
						.setDescription('Disable chat option or use default parameters.'),
				)
				.addStringOption((option) =>
					option
						.setName('prompt')
						.setDescription('Enter your prompt in 1000 characters.')
						.setMaxLength(1000)
						.setRequired(false),
				)
				.addStringOption((option) =>
					option
						.setName('prefix')
						.setDescription('Set the prefix to call Dahlia.')
						.setRequired(false),
				)
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Choose the channel for Dahlia to reply.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('rules').setDescription('Setup rules for the server.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('settings').setDescription('Show current server settings.'),
		),
	cooldown: 3000,
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		if (
			!interaction.member.permissions.has(
				PermissionsBitField.Flags.Administrator,
			)
		) {
			return await interaction.reply({
				content: 'You do not have permissions to setup the server.',
				ephemeral: true,
			});
		}

		const guildCheck = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});

		const { options } = interaction;
		const subCommand = options.getSubcommand();

		switch (subCommand) {
			case 'register':
				try {
					if (guildCheck) {
						return await interaction.reply({
							content: 'Guild already registered.',
							ephemeral: true,
						});
					}

					await Guild.create({ guildID: interaction.guild.id });
					await interaction.reply({
						content: 'Guild registered.',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'twitter':
				if (!await validateFeature(interaction, guildCheck.version, 'ownTwitter')) {
					return;
				}

				try {

					if (interaction.member.id !== interaction.guild.ownerId) {
						return await interaction.reply({
							content: 'You do not have permission to perform this action.',
							ephemeral: true,
						});
					}

					if (guildCheck.twitterID) {
						return await interaction.reply({
							content: `Server logged in as \`${guildCheck.username}\`.`,
							ephemeral: true,
						});
					}
					else {
						await twitterAuth(interaction);
					}

					setTimeout(() => {
						Twitter.findOne({ where: { discordID: interaction.member.id } })
							.then((user) => {
								if (user.username !== null) {
									// Transfers the tokens to the Guild table
									Guild.update(
										{
											twitterID: user.twitterID,
											username: user.username,
											accessToken: user.accessToken,
											refreshToken: user.refreshToken,
											expiresIn: user.expiresIn,
											expirationTime: user.expirationTime,
										},
										{ where: { guildID: interaction.guild.id } },
									)
										.then(() => {
											Twitter.destroy({
												where: { discordID: interaction.member.id },
											})
												.then(() => {
													return interaction.followUp({
														content: `Tokens transferred to the Guild.\n\nServer now logged in as \`${user.username}\`.`,
														ephemeral: true,
													});
												})
												.catch((error) => {
													console.error(
														'Error clearing tokens in Twitter table:',
														error,
													);
												});
										})
										.catch((error) => {
											console.error(
												'Error transferring tokens to Guild table:',
												error,
											);
										});
								}
								else {
									Twitter.destroy({
										where: { discordID: interaction.member.id },
									});
									Guild.update(
										{
											twitterID: '',
											username: '',
											accessToken: '',
											refreshToken: '',
											expiresIn: '',
											expirationTime: '',
										},
										{ where: { guildID: interaction.guild.id } },
									);

									interaction.followUp({
										content: 'Session expired. Please try logging in again.',
										ephemeral: true,
									});
								}
							})
							.catch((error) => {
								console.error(error);
							});
					}, 180000);
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'disable':
				try {
					// Add a warning to confirm deletion of the guild entry.

					if (!guildCheck) {
						return await interaction.reply({
							content: 'Dahlia is not yet setup in this server.',
							ephemeral: true,
						});
					}
					await guildCheck.destroy({
						where: { guildID: interaction.guild.id },
					});
					await interaction.reply({
						content: 'Guild has been un-registered.',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'logs':
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}

					const logsChannel = options.getChannel('channel');

					await guildCheck.update({ logsChannelID: logsChannel.id });
					await interaction.reply({
						content: 'Audit Logs channel assigned.',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'captcha':
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}

					const type = options.getString('type');
					const verifyChannel = options.getChannel('channel');
					const role = options.getRole('role');

					await guildCheck.update({
						type: type,
						verifyChannelID: verifyChannel.id,
						verifyRoleID: role.id,
					});
					await interaction.reply({
						content: 'Captcha settings saved!',
						ephemeral: true,
					});


				}
				catch (error) {
					console.log(error);
				}
				break;

			case 'shop':
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}

					const whitelist = options.getChannel('channel');

					await guildCheck.update({ whitelistChannelID: whitelist.id });
					await interaction.reply({
						content: 'Verification disabled!',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'deploy':
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}
					await captcha(interaction, guildCheck.verifyChannelID);
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'factions':
				if (!await validateFeature(interaction, guildCheck.version, 'hasRoles')) {
					return;
				}

				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}

					const margaretha = options.getRole('margaretha');
					const cerberon = options.getRole('cerberon');

					await guildCheck.update({
						margarethaID: margaretha.id,
						margarethaName: margaretha.name,
						cerberonID: cerberon.id,
						cerberonName: cerberon.name,
					});
					await interaction.reply({
						content: 'Factions roles have been set successfully!',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'rules':
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}

					await rules(interaction);
				}
				catch (error) {
					console.log(error);
				}
				break;

			case 'settings':
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}

					const embed = new EmbedBuilder().setTitle(
						`Current settings for ${interaction.guild.name}`,
					);

					const fieldMap = [
						{
							check: 'verifyChannelID',
							name: 'Verify Channel:',
							inline: true,
							valueFunc: channelMention,
						},
						{
							check: 'verifyRoleID',
							name: 'Verify Role:',
							inline: true,
							valueFunc: roleMention,
						},
						{
							check: 'twitterChannelID',
							name: 'Twitter Channel:',
							inline: true,
							valueFunc: channelMention,
						},
						{
							check: 'raidRoleID',
							name: 'Raid Role:',
							inline: true,
							valueFunc: roleMention,
						},
						{
							check: 'username',
							name: 'Server Twitter Account:',
							inline: false,
							valueFunc: (v) => `[@${v}](https://www.twitter.com/${v})`,
						},
						{
							check: 'logsChannelID',
							name: 'Audit Logs Channel:',
							inline: false,
							valueFunc: channelMention,
						},
						{
							check: 'whitelistChannelID',
							name: 'Whitelist Shop Channel:',
							inline: false,
							valueFunc: channelMention,
						},
						{
							check: 'margarethaID',
							name: 'Margaretha Role:',
							inline: true,
							valueFunc: roleMention,
						},
						{
							check: 'cerberonID',
							name: 'Cerberon Role:',
							inline: true,
							valueFunc: roleMention,
						},
						{
							check: 'chatPrefix',
							name: 'Chat Prefix:',
							inline: true,
							valueFunc: (v) => `\`${v}\``,
						},
						{
							check: 'chatChannelID',
							name: 'Chat Channel:',
							inline: true,
							valueFunc: channelMention,
						},
						{
							check: 'chatPrompt',
							name: 'Chat Prompt:',
							inline: false,
							valueFunc: (v) => `\`${v}\``,
						},
					];

					const fields = fieldMap
						.filter((field) => guildCheck[field.check])
						.map((field) => ({
							name: field.name,
							value: field.valueFunc(guildCheck[field.check]),
							inline: field.inline,
						}));

					if (fields.length === 0) {
						embed.addFields({
							name: 'No settings found',
							value: 'Please configure your guild settings.',
							inline: false,
						});
					}
					else {
						embed.addFields(...fields);
					}

					await interaction.reply({ embeds: [embed], ephemeral: true });
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'chat':
				if (!await validateFeature(interaction, guildCheck.version, 'ownDahlia')) {
					return;
				}
				
				try {
					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}
					const updateFields = {};
					let responseMsg = '';
					const prefix = options.getString('prefix');
					const channel = options.getChannel('channel');
					const prompt = options.getString('prompt');
					const disable = options.getBoolean('disable');

					if (disable) {
						updateFields.chatPrefix = null;
						updateFields.chatChannelID = null;
						updateFields.chatPrompt = null;
						responseMsg += 'Chat has been disabled.\n';
					}
					else {
						if (prefix) {
							updateFields.chatPrefix = prefix;
							responseMsg += `Chat Prefix has been set to \`${prefix}\`.\n`;
						}

						if (channel) {
							updateFields.chatChannelID = channel.id;
							responseMsg += `Chat Channel has been set to ${channelMention(channel.id)}.\n`;
						}

						if (prompt) {
							updateFields.chatPrompt = prompt;
							responseMsg += `Chat Prompt has been set to \`${prompt}\`.\n`;
						}
					}

					if (Object.keys(updateFields).length > 0) {
						await guildCheck.update(updateFields);
						await interaction.reply({
							content: responseMsg,
							ephemeral: true,
						});
					}
					else {
						await interaction.reply({
							content: 'No chat settings were provided to update.',
							ephemeral: true,
						});
					}
				}
				catch (error) {
					console.error(error);
				}
				break;
		}
	},
};
