const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	ChannelType,
} = require('discord.js');
const { Player, Guild } = require('../../src/db');
const { validateFeature } = require('../../src/feature');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('open')
		.setDescription('Creates a portal')
		.addStringOption((option) =>
			option
				.setName('channel')
				.setDescription('Enter name of channel')
				.setRequired(true),
		),
	cooldown: 900000,
	async execute(interaction) {
		const channel_name = interaction.options.getString('channel');
		const { member, guild } = interaction;

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
			});

			const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
			if (!await validateFeature(interaction, guildCheck.subscription, 'hasRoles')) {
				return;
			}

			if (!player) {
				throw new Error('profile not found');
			}

			if (!guildCheck) {
				throw new Error('guild not found');
			}

			await interaction.deferReply({ ephemeral: true });
			// if (
			// 	!member.roles.cache.some(
			// 		(role) => role.name === guildCheck.margarethaName || role.name === guildCheck.cerberonName,
			// 	)
			// ) {
			// 	return interaction.editReply(
			// 		'You don\'t seem to have a proper faction yet. Please choose your faction then `/start` again.',
			// 	);
			// }

			const guild_name = await guild.channels.create({
				name: channel_name,
				type: ChannelType.GuildText,
				permissionOverwrites: [
					{
						id: guild.id, // Everyone else except for admins
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{
						id: member.id, // The user
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.ManageChannels,
							PermissionFlagsBits.SendMessages,
							PermissionFlagsBits.ReadMessageHistory,
							PermissionFlagsBits.UseApplicationCommands,
						],
					},
					{
						id: interaction.client.user.id, // The bot
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.ManageChannels,
							PermissionFlagsBits.SendMessages,
							PermissionFlagsBits.ReadMessageHistory,
							PermissionFlagsBits.UseApplicationCommands,
						],
					},
				],
			});

			const time = 15;

			const jobs = await interaction.client.deleteChannelQueue.getJobs(['waiting', 'delayed']);

			const hasExistingJob = jobs.some(job => job.data.userId === member.id);

			if (hasExistingJob) {
				return await interaction.reply({ content: 'You already have a portal waiting to be deleted. Please wait for it to be deleted before creating a new one or use `/close` to close the existing one manually.', ephemeral: true });
			}

			await interaction.client.deleteChannelQueue.add({
				channelId: guild_name.id,
				guildId: guild.id,
				userId: member.id,
				replyChannelId: interaction.channel.id,
			}, { delay: time * 60000, attempts: 3 });

			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle('Success!')
				.setDescription(
					`Portal: **${guild_name}** has been opened.\n\nPlease note that the portal gets closed after \`${time}\` minute/s! Just create another one whenever.\n\nIf you want to close the channel pre-maturely, you can run the \`/close\` command.\n\nSafe travels!`,
				);
			await interaction.editReply({
				content: `${member}`,
				embeds: [embed],
				ephemeral: true,
			});
		}
		catch (error) {
			console.error(error);
		}
	},
};