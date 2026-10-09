const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	ChannelType,
	channelMention,
} = require('discord.js');
const { Player, Guild } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { portalJobId, portalJobOptions, findPortalJob } = require('../../functions/portal');

// How long a portal stays open, in minutes.
const PORTAL_MINUTES = 15;

const PORTAL_PERMISSIONS = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.ManageChannels,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.ReadMessageHistory,
	PermissionFlagsBits.UseApplicationCommands,
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('open')
		.setDescription('Creates a portal')
		.addStringOption((option) =>
			option
				.setName('channel')
				.setDescription('Enter name of channel')
				.setMaxLength(100)
				.setRequired(true),
		),
	cooldown: 900000,
	async execute(interaction) {
		const channelName = interaction.options.getString('channel');
		const { member, guild, client } = interaction;
		const queue = client.deleteChannelQueue;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasRoles')) {
			return;
		}

		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) {
			throw new Error('profile not found');
		}

		await interaction.deferReply({ flags: 64 });

		const busy = 'You already have a portal open. Please wait for it to close, or use `/close` to close it now.';
		if (await findPortalJob(queue, guild.id, member.id)) {
			return interaction.editReply(busy);
		}

		const portal = await guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			permissionOverwrites: [
				// everyone else except admins
				{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
				{ id: member.id, allow: PORTAL_PERMISSIONS },
				{ id: client.user.id, allow: PORTAL_PERMISSIONS },
			],
		});

		try {
			await queue.add({
				channelId: portal.id,
				guildId: guild.id,
				userId: member.id,
				replyChannelId: interaction.channel.id,
			}, portalJobOptions(guild.id, member.id, PORTAL_MINUTES * 60000));
		}
		catch (error) {
			await portal.delete().catch(() => null);
			throw error;
		}

		// a simultaneous /open got there first: Bull kept its job (same ID), so drop our channel
		const job = await queue.getJob(portalJobId(guild.id, member.id));
		if (job?.data.channelId !== portal.id) {
			await portal.delete().catch(() => null);
			return interaction.editReply(busy);
		}

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('Success!')
			.setDescription(
				`Portal: **${channelMention(portal.id)}** has been opened.\n\nPlease note that the portal gets closed after \`${PORTAL_MINUTES}\` minute/s! Just create another one whenever.\n\nIf you want to close the channel pre-maturely, you can run the \`/close\` command.\n\nSafe travels!`,
			);
		await interaction.editReply({ content: `${member}`, embeds: [embed] });
	},
};
