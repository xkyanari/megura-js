const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { Brawl, Player } = require('../../src/db');
const { simulateBrawl } = require('../../functions/brawl');
const { isTestnet } = require('../../config.json');

module.exports = {
	data: {
		name: 'brawl-accept',
	},
	async execute(interaction) {
		try {
			const listingId = interaction.message.embeds[0].data.footer.text.split(' ')[2];

			const challenger = await Brawl.findOne({ where: { listingId: listingId } });

			if (interaction.member.id === challenger.challengerId) return interaction.reply({ content: 'You cannot challenge yourself!', ephemeral: true });

			const acceptor = await Player.findOne({ where: { discordID: interaction.member.id, guildID: interaction.guild.id } });

			if (!acceptor) {
				throw new Error('profile not found');
			}

			if (!isTestnet) {
				if (acceptor.oresEarned < challenger.wager) return interaction.reply({ content: 'You do not have enough ores to accept the challenge!', ephemeral: true });
				const originalWager = challenger.wager;
				challenger.wager += challenger.wager;
				acceptor.oresEarned -= originalWager;
			}

			challenger.acceptorId = interaction.member.id;
			await challenger.save();

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
			console.error(error);
		}
	},
};
