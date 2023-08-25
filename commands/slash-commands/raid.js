const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { twitterAuth } = require('../../functions/twitter');
const { Twitter, Guild } = require('../../src/db');
const post = require('../../functions/post');
const raidCheck = require('../../functions/raidcheck');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('raid')
		.setDescription('Join the raid!')
		.addSubcommand((subcommand) =>
			subcommand.setName('join').setDescription('Login to Twitter.'),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('remove').setDescription('Remove link to Twitter.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('check')
				.setDescription(
					'Check the Discord users who retweeted and liked the tweets.',
				)
				.addStringOption((option) =>
					option
						.setName('tweet')
						.setDescription('Enter the URL or link of the tweet.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('post')
				.setDescription('Post a tweet for users to RT and Like.')
				.addStringOption((option) =>
					option
						.setName('tweet')
						.setDescription('Enter the URL or link of the tweet.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('role')
				.setDescription('Select a role for raiders to receive notifications.')
				.addRoleOption((option) =>
					option
						.setName('name')
						.setDescription('Enter the name of the role.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('channel')
				.setDescription('Select a channel to post tweets for raids.')
				.addChannelOption((option) =>
					option
						.setName('name')
						.setDescription('Enter the name of the channel.')
						.setRequired(true),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { options } = interaction;
		const subCommand = options.getSubcommand();

		const twitter = await Twitter.findOne({
			where: { discordID: interaction.member.id },
		});
		const guildCheck = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});

		switch (subCommand) {
			case 'join':
				try {
					await twitterAuth(interaction);

					setTimeout(() => {
						Twitter.findOne({ where: { discordID: interaction.member.id } })
							.then((user) => {
								if (user.twitterID !== null) {
									return interaction.followUp({
										content: 'You\'re now logged in.',
										ephemeral: true,
									});
								}
								else {
									Twitter.destroy({
										where: { discordID: interaction.member.id },
									});
									interaction.followUp({
										content: 'Your session expired. Please try logging in again.',
										ephemeral: true,
									});
								}
							})
							.catch((error) => {
								console.error(error);
							});
					}, 120000);
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'remove':
				try {
					if (twitter) {
						await Twitter.destroy({
							where: { discordID: interaction.member.id },
						});
						return await interaction.reply({
							content: 'Your Twitter access has been revoked.',
							ephemeral: true,
						});
					}
					else {
						await interaction.reply({
							content: 'You do not have a Twitter account linked.',
							ephemeral: true,
						});
					}
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'post':
				try {
					if (
						!interaction.member.permissions.has(
							PermissionsBitField.Flags.Administrator,
						)
					) {
						return await interaction.reply({
							content: 'You do not have sufficient permissions to post a tweet!',
							ephemeral: true,
						});
					}

					if (
						!guildCheck ||
						!guildCheck.twitterChannelID ||
						!guildCheck.raidRoleID
					) {
						return await interaction.reply({
							content: 'Please register the guild first and assign a Twitter channel and role.',
							ephemeral: true,
						});
					}
					await post(
						interaction,
						guildCheck.twitterChannelID,
						guildCheck.raidRoleID,
					);
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'role':
				try {
					if (
						!interaction.member.permissions.has(
							PermissionsBitField.Flags.Administrator,
						)
					) {
						return await interaction.reply({
							content: 'You do not have sufficient permissions to post a tweet!',
							ephemeral: true,
						});
					}

					const raidRole = options.getRole('name');

					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}
					await guildCheck.update({ raidRoleID: raidRole.id });
					await interaction.reply({
						content: 'Role for raids have been assigned.',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'channel':
				try {
					if (
						!interaction.member.permissions.has(
							PermissionsBitField.Flags.Administrator,
						)
					) {
						return await interaction.reply({
							content: 'You do not have sufficient permissions to select a channel!',
							ephemeral: true,
						});
					}

					const twitterChannel = options.getChannel('name');

					if (!guildCheck) {
						return await interaction.reply({
							content: 'Please register the guild first.',
							ephemeral: true,
						});
					}
					await guildCheck.update({ twitterChannelID: twitterChannel.id });
					await interaction.reply({
						content: 'Twitter channel assigned.',
						ephemeral: true,
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'check':
				try {
					if (
						!interaction.member.permissions.has(
							PermissionsBitField.Flags.Administrator,
						)
					) {
						return await interaction.reply({
							content: 'You do not have sufficient permissions to select a channel!',
							ephemeral: true,
						});
					}

					const tweetURL = interaction.options.getString('tweet');
					const tweetId = tweetURL.match(/(\d+)/)[0];

					await raidCheck(interaction, tweetId);
				}
				catch (error) {
					console.error(error);
				}
				break;
		}
	},
};
