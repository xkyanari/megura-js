const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { Player } = require('../../src/db');
const { simulateBrawl } = require('../../functions/brawl');
const { acceptBrawl, settleBrawl, BRAWL_SETTLE_TIMEOUT } = require('../../functions/brawlWager');

const rejections = {
	'not open': 'This challenge is no longer open.',
	'taken': 'Someone else already accepted this challenge.',
	'self': 'You cannot challenge yourself!',
	'insufficient funds': 'You do not have enough ores to accept the challenge!',
};

module.exports = {
	data: {
		name: 'brawl-accept',
	},
	async execute(interaction) {
		const listingId = interaction.message.embeds[0].data.footer.text.split(' ')[2];
		const guildID = interaction.guild.id;

		const acceptor = await Player.findOne({ where: { discordID: interaction.member.id, guildID } });

		if (!acceptor) {
			throw new Error('profile not found');
		}

		const result = await acceptBrawl(listingId, interaction.member.id, guildID);
		if (!result.ok) {
			return interaction.reply({ content: rejections[result.reason], flags: 64 });
		}

		const challenger = result.brawl;

		// Safety net: if the brawl never finishes (crash, restart), refund both stakes as a draw.
		try {
			await interaction.client.brawlQueue.add(
				{ type: 'settle', listingId, guildID },
				{ delay: BRAWL_SETTLE_TIMEOUT, removeOnComplete: true },
			);
		}
		catch (error) {
			console.error('Could not queue brawl settle timeout:', error);
		}

		try {
			const brawl_channel = await interaction.guild.channels.create({
				name: `brawl-${listingId}`,
				type: ChannelType.GuildText,
				permissionOverwrites: [
					{
						id: interaction.guild.id, // Everyone else except for admins
						deny: [PermissionFlagsBits.ViewChannel],
					},
					{
						id: challenger.challengerId, // The challenger
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.SendMessages,
						],
					},
					{
						id: interaction.member.id, // The acceptor
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.SendMessages,
						],
					},
					{
						id: interaction.client.user.id, // The bot
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.ManageChannels,
							PermissionFlagsBits.SendMessages,
							PermissionFlagsBits.ReadMessageHistory,
						],
					},
				],
			});
			await interaction.message.delete();

			await simulateBrawl(interaction, brawl_channel, challenger.challengerId, interaction.member.id);
		}
		catch (error) {
			// e.g. missing permission to create the channel: call it off and refund both
			await settleBrawl(listingId, guildID, null);
			throw error;
		}
	},
};
