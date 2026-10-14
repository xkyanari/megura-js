const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, channelMention, roleMention, userMention } = require('discord.js');
const { Guild, Ticket, TicketConfig } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { logSetupChange } = require('../../functions/logs');
const { DELETE_DELAY, openButton, panelEmbed, closeTicketFor } = require('../../functions/ticket');

const CLOSE_REFUSALS = {
	'not allowed': 'Only the member who opened this ticket, or staff, can close it.',
	'already closed': 'This ticket is already closed.',
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ticket')
		.setDescription('Support tickets: private channels between a member and your staff.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setup')
				.setDescription('Choose who handles tickets and where ticket channels go.')
				.addRoleOption((option) =>
					option.setName('staff_role').setDescription('The role that can see and answer tickets.').setRequired(true),
				)
				.addChannelOption((option) =>
					option.setName('category').setDescription('Category to create ticket channels in.').addChannelTypes(ChannelType.GuildCategory),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('panel')
				.setDescription('Post the "Open ticket" button.')
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to post it (default: this channel).').addChannelTypes(ChannelType.GuildText),
				)
				.addStringOption((option) =>
					option.setName('message').setDescription('Text shown above the button.').setMaxLength(1024),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('close').setDescription('Close the ticket in this channel.'),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { options, guild } = interaction;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasTickets')) {
			return;
		}

		const subcommand = options.getSubcommand();

		if (subcommand === 'setup') {
			const role = options.getRole('staff_role');
			const category = options.getChannel('category');
			if (role.id === guild.id) {
				return interaction.reply({ content: 'Pick a staff role other than @everyone.', flags: 64 });
			}
			if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
				return interaction.reply({ content: 'I need the **Manage Channels** permission to create ticket channels.', flags: 64 });
			}

			await TicketConfig.upsert({ guildID: guild.id, staffRoleID: role.id, categoryID: category?.id ?? null });
			await interaction.reply({
				content: `Tickets will be handled by ${roleMention(role.id)}${category ? ` in **${category.name}**` : ''}. Post the button with \`/ticket panel\`.`,
				flags: 64,
				allowedMentions: { parse: [] },
			});
			await logSetupChange(interaction, 'set up tickets', [
				{ name: 'Staff role', value: roleMention(role.id), text: role.name },
				{ name: 'Category', value: category?.name ?? 'none' },
			]);
			return;
		}

		if (subcommand === 'panel') {
			if (!await TicketConfig.findByPk(guild.id)) {
				return interaction.reply({ content: 'Run `/ticket setup` first.', flags: 64 });
			}
			const channel = options.getChannel('channel') ?? interaction.channel;
			await interaction.deferReply({ flags: 64 });
			await channel.send({ embeds: [panelEmbed(options.getString('message'))], components: [openButton()] });
			await interaction.editReply(`Posted the ticket button in ${channelMention(channel.id)}.`);
			return;
		}

		if (subcommand === 'close') {
			const ticket = await Ticket.findOne({ where: { guildID: guild.id, channelID: interaction.channelId } });
			if (!ticket) {
				return interaction.reply({ content: 'This channel isn\'t a ticket.', flags: 64 });
			}
			const result = await closeTicketFor(interaction, ticket.id);
			if (!result.ok) {
				return interaction.reply({ content: CLOSE_REFUSALS[result.reason], flags: 64 });
			}
			await interaction.reply({
				content: `🔒 Ticket closed by ${userMention(interaction.user.id)}. This channel will be deleted in ${DELETE_DELAY / 1000} seconds.`,
				allowedMentions: { parse: [] },
			});
		}
	},
};
