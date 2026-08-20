const {
	SlashCommandBuilder,
	ChannelType,
	EmbedBuilder,
	channelMention,
	roleMention,
} = require('discord.js');
const { Guild } = require('../../src/db');
const captcha = require('../../functions/verify');
const rules = require('../../functions/rules');
const { validateFeature } = require('../../src/feature');
const { changeChannel } = require('../../functions/webhook');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Initiate setup to your server!')
		.setDefaultMemberPermissions('0')
		.addSubcommand((subcommand) =>
			subcommand.setName('register').setDescription('Register guild.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('disable').setDescription('WARNING!! THIS OPTION RESETS ALL CONFIGURATION IN THE SERVER'),
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
				.setName('mods')
				.setDescription('Assign channel for moderator logs.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Choose the channel for moderator logs and purchases.')
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
				.setDescription('Special Shop.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Choose the channel for the Special Shop announcements.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('deploy').setDescription('Deploy CAPTCHA to its assigned Verification channel.'),
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
							flags: 64,
						});
					}

					await Guild.create({ guildID: interaction.guild.id });
					await interaction.reply({
						content: 'Guild registered.',
						flags: 64,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'disable':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}

					await interaction.deferReply({ flags: 64 });

					await guildCheck.update({
						verifyChannelID: '',
						verifyMessageID: '',
						verifyRoleID: '',
						logsChannelID: '',
						specialShopChannelID: '',
						specialShopWebhookID: '',
						specialShopWebhookToken: '',
						twitterChannelID: '',
						raidRoleID: '',
						margarethaID: '',
						margarethaName: '',
						cerberonID: '',
						cerberonName: '',
						chatPrefix: '',
						chatChannelID: '',
						chatPrompt: '',
						intro: '',
						rules: '',
						closing: '',
						arenaBoss: '',
						customToken: '',
						twitterID: '',
						username: '',
						accessToken: '',
						refreshToken: '',
						expiresIn: '',
						expirationTime: '',
						walletAmount: 500000,
						webhookId: '',
						webhookToken: '',
						webhookChannelID: '',
						auctionChannelID: '',
						auctionwebhookId: '',
						auctionwebhookToken: '',
						brawlChannelID: '',
						brawlwebhookId: '',
						brawlwebhookToken: '',
						where: { guildID: interaction.guild.id },
					});
					await interaction.editReply({
						content: 'Guild has been reset.',
						flags: 64,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'logs':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}

					await interaction.deferReply({ flags: 64 });

					const logsChannel = options.getChannel('channel');

					await interaction.deferReply({ flags: 64 });

					await guildCheck.update({ logsChannelID: logsChannel.id });
					await interaction.editReply({
						content: 'Audit Logs channel assigned.',
						flags: 64,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'mods':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}

					await interaction.deferReply({ flags: 64 });

					const modsChannel = options.getChannel('channel');

					await interaction.deferReply({ flags: 64 });

					const fieldsToUpdate = {
						channelField: 'webhookChannelID',
						webhookIDField: 'webhookId',
						webhookTokenField: 'webhookToken',
						webhookName: 'modChannel',
						webhookReason: 'For posting purchases',
					};
					const moderationChannel = await changeChannel(interaction, interaction.guild.id, modsChannel.id, fieldsToUpdate);

					if (moderationChannel) {
						return await interaction.editReply({
							content: 'Moderation Logs channel assigned.',
							flags: 64,
						});
					}
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'captcha':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}

					await interaction.deferReply({ flags: 64 });

					const type = options.getString('type');
					const verifyChannel = options.getChannel('channel');
					const role = options.getRole('role');

					await guildCheck.update({
						type: type,
						verifyChannelID: verifyChannel.id,
						verifyRoleID: role.id,
					});
					await interaction.editReply({
						content: 'Captcha settings saved!',
						flags: 64,
					});


				}
				catch (error) {
					console.log(error);
				}
				break;

			case 'shop':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}

					await interaction.deferReply({ flags: 64 });

					const specialShop = options.getChannel('channel');

					await interaction.deferReply({ flags: 64 });

					const fieldsToUpdate = {
						channelField: 'specialShopChannelID',
						webhookIDField: 'specialShopWebhookID',
						webhookTokenField: 'specialShopWebhookToken',
						webhookName: 'announcementChannel',
						webhookReason: 'For announcement purchases',
					};
					const specialChannel = await changeChannel(interaction, interaction.guild.id, specialShop.id, fieldsToUpdate);

					if (specialChannel) {
						return await interaction.editReply({
							content: 'Special Shop announcement channel saved!',
							flags: 64,
						});
					}
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'deploy':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}
					await interaction.deferReply({ flags: 64 });
					await captcha(interaction, guildCheck.verifyChannelID);
				}
				catch (error) {
					console.error(error);
					if (!interaction.replied && !interaction.deferred) {
						await interaction.reply({
							content: 'I could not deploy the verification message. Please run `/setup register`, `/setup captcha`, and `/setup rules`, then try again.',
							flags: 64,
						});
					}
				}
				break;

			case 'factions':
				if (!await validateFeature(interaction, guildCheck.subscription, 'hasRoles')) {
					return;
				}

				try {
					if (!guildCheck) {
						throw new Error('guild not found');
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
						flags: 64,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'rules':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
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
						throw new Error('guild not found');
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
							check: 'logsChannelID',
							name: 'Audit Logs Channel:',
							inline: false,
							valueFunc: channelMention,
						},
						{
							check: 'specialShopChannelID',
							name: 'Special Shop Channel:',
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
						{
							check: 'walletAmount',
							name: 'Wallet Balance:',
							inline: false,
							valueFunc: (v) => `\`${v}\` ORES`,
						},
						{
							check: 'webhookChannelID',
							name: 'Moderator Channel:',
							inline: true,
							valueFunc: channelMention,
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

					await interaction.reply({ embeds: [embed], flags: 64 });
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'chat':
				if (!await validateFeature(interaction, guildCheck.subscription, 'ownDahlia')) {
					return;
				}

				try {
					if (!guildCheck) {
						throw new Error('guild not found');
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
							flags: 64,
						});
					}
					else {
						await interaction.reply({
							content: 'No chat settings were provided to update.',
							flags: 64,
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
