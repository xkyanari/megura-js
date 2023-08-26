const {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ChannelType,
} = require('discord.js');
const { footer, brawlImage } = require('../../src/vars');
const { Guild } = require('../../src/db');
const { changeChannel } = require('../../functions/webhook');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('brawl')
		.setDescription('Put a notice board for challenges.')
		.setDefaultMemberPermissions('0')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('start')
				.setDescription('Start a brawl!'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('channel')
				.setDescription('Assign a channel for the scoreboard.')
				.addChannelOption((option) =>
					option
						.setName('channel')
						.setDescription('Choose one.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		),
	cooldown: 10000,
	async execute(interaction) {
		const guildCheck = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});

		const { options } = interaction;
		const subCommand = options.getSubcommand();

		switch (subCommand) {
			case 'start':
				try {
					const embed = new EmbedBuilder()
						.setColor(0xcd7f32)
						.setTitle('⚔️ **BRAWL:** ⚔️')
						.setDescription('Challenge voyagers for a brawl here!')
						.setImage(brawlImage)
						.setFooter(footer);

					const button = new ButtonBuilder()
						.setCustomId('brawl-start')
						.setLabel('Start a Brawl')
						.setStyle(ButtonStyle.Primary);

					const row = new ActionRowBuilder()
						.addComponents(button);

					await interaction.reply({
						embeds: [embed],
						components: [row],
					});
				}
				catch (error) {
					console.error(error);
				}
				break;

			case 'channel':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}

					await interaction.deferReply({ ephemeral: true });

					const channel = options.getChannel('channel');

					const fieldsToUpdate = {
						channelField: 'brawlChannelID',
						webhookIDField: 'brawlwebhookId',
						webhookTokenField: 'brawlwebhookToken',
						webhookName: 'brawlChannel',
						webhookReason: 'For posting brawl outcomes',
					};
					const brawlChannel = await changeChannel(interaction, interaction.guild.id, channel.id, fieldsToUpdate);

					if (brawlChannel) {
						return await interaction.editReply({
							content: 'Brawl channel assigned.',
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
