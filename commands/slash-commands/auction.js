const { SlashCommandBuilder, EmbedBuilder, ChannelType, channelMention, userMention } = require('discord.js');
const { validateFeature } = require('../../src/feature');
const { startAuction, MAX_HOURS } = require('../../functions/startAuction');
const { endAuction } = require('../../functions/endAuction');
const { changeChannel } = require('../../functions/webhook');
const { Guild } = require('../../src/db');
const { announceAuctionEnd } = require('../../functions/auctionMessage');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('auction')
		.setDescription('Manage auctions.')
		.setDefaultMemberPermissions('0')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('start')
				.setDescription('Start an Auction.')
				.addStringOption(option =>
					option.setName('item')
						.setDescription('Name of the item to be auctioned')
						.setRequired(true))
				.addNumberOption(option =>
					option.setName('startprice')
						.setDescription('Starting price of the auction in Bitcoin')
						.setMinValue(0.00000001)
						.setMaxValue(999999)
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('endtime')
						.setDescription('Duration of the auction in hours')
						.setMinValue(1)
						.setMaxValue(MAX_HOURS)
						.setRequired(true))
				.addStringOption(option =>
					option.setName('description')
						.setDescription('Description of the item')
						.setRequired(false))
				.addIntegerOption(option =>
					option.setName('quantity')
						.setDescription('Quantity of the item')
						.setMinValue(1)
						.setRequired(false))
				.addAttachmentOption(option =>
					option
						.setName('image')
						.setDescription('Attach an image as preview for the auctioned item.')
						.setRequired(false)),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('end')
				.setDescription('End an Auction.')
				.addIntegerOption(option =>
					option.setName('auctionid')
						.setDescription('Enter the auction ID of the auction you want to end')
						.setMinValue(1)
						.setRequired(true)),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('settings')
				.setDescription('Adjust settings for auctions.')
				.addChannelOption((option) =>
					option
						.setName('channelid')
						.setDescription('Choose the channel for auctions.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { options } = interaction;
		const subCommand = options.getSubcommand();
		const guildCheck = await Guild.findOne({ where: { guildID: interaction.guild.id } });

		const item1 = options.getString('item');
		const description = options.getString('description');
		const quantity = options.getInteger('quantity');
		const startPrice = options.getNumber('startprice');
		const endTime = options.getInteger('endtime');
		const attachment = options.getAttachment('image');
		let attachmentUrl = null;

		switch (subCommand) {
			case 'start': {
				await interaction.deferReply();
				if (!guildCheck) {
					throw new Error('guild not found');
				}
				if (!await validateFeature(interaction, guildCheck.subscription, 'hasAuction')) {
					return;
				}

				if (attachment) {
					attachmentUrl = attachment.proxyURL;
				}

				const start = await startAuction(interaction, item1, description, quantity, startPrice, endTime, interaction.user.id, attachmentUrl);

				// respond to the interaction
				if (start) {
					const startDateTimeUnix = Math.floor(start.startDateTime.getTime() / 1000);
					const endDateTimeUnix = Math.floor(start.endDateTime.getTime() / 1000);

					const embed0 = new EmbedBuilder()
						.setTitle('Auction Started!')
						.setColor(0xcd7f32)
						.setDescription(`**Item Name:** ${item1}\n**Starting Price:** ${startPrice} 🪙\n**Start Time:** <t:${startDateTimeUnix}:f>\n**Ending Time:** <t:${endDateTimeUnix}:f>\n**Auctioneer:** ${userMention(interaction.user.id)}\nAuction ID: ${start.id}`);

					await interaction.editReply({
						embeds: [embed0],
					});

				}
				else {
					await interaction.editReply({ content: 'Sorry, there was a problem starting the auction.', flags: 64 });
				}
				break;
			}

			case 'end': {
				// this command only updates the auction end time and gets the highest bidder
				await interaction.deferReply();
				if (!guildCheck) {
					throw new Error('guild not found');
				}
				if (!await validateFeature(interaction, guildCheck.subscription, 'hasAuction')) {
					return;
				}

				const id = options.getInteger('auctionid');
				const auction = await endAuction(id, interaction.guild.id);
				if (!auction) {
					return interaction.editReply({ content: `There's no auction #${id} in this server.` });
				}

				// the timer is no longer needed
				const job = await interaction.client.auctionQueue.getJob(`auction-${id}`).catch(() => null)
					?? (await interaction.client.auctionQueue.getJobs(['waiting', 'delayed'])).find((j) => j.data.auctionId === id);
				await job?.remove().catch(() => null);

				const posted = await announceAuctionEnd(auction);
				await interaction.editReply({
					content: posted
						? 'Auction ended successfully.'
						: 'Auction ended. I couldn\'t update its post: check the auction channel with `/auction settings`.',
				});
				break;
			}
			case 'settings': {
				if (!guildCheck) {
					throw new Error('guild not found');
				}
				if (!await validateFeature(interaction, guildCheck.subscription, 'hasAuction')) {
					return;
				}
				await interaction.deferReply();
				const channel = options.getChannel('channelid');

				const fieldsToUpdate = {
					channelField: 'auctionChannelID',
					webhookIDField: 'auctionwebhookId',
					webhookTokenField: 'auctionwebhookToken',
					webhookName: 'auctionChannel',
					webhookReason: 'For announcements related to auctions',
				};
				const updateChannel = await changeChannel(interaction, interaction.guild.id, channel.id, fieldsToUpdate);

				if (updateChannel) {
					return await interaction.editReply({
						content: `Auction Channel has been set to ${channelMention(channel.id)}.\n`,
						flags: 64,
					});
				}
				break;
			}
		}
	},
};
