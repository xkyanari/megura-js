const { WebhookClient, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, userMention } = require('discord.js');
const { withdrawBid } = require("../../functions/withdrawBid");
const { User, Auction, Guild } = require("../../src/db");
const { dahliaAvatar, dahliaName } = require('../../src/vars');

module.exports = {
    data: {
        name: 'withdrawBid',
    },
    async execute(interaction) {
        try {
            const user = await User.findOne({ where: { discordID: interaction.member.id } });
            if (!user || !user.walletAddress) return await interaction.reply({ content: 'Please register your wallet first.', ephemeral: true });

            const withdraw = await withdrawBid(interaction);

            const auction = await Auction.findByPk(withdraw.id);
            const item = await auction.getAuctionItem();
            const { auctionwebhookId, auctionwebhookToken } = await Guild.findOne({ where: { guildId: interaction.guild.id } });
            const webhookClient = new WebhookClient({ id: auctionwebhookId, token: auctionwebhookToken });

            const startDateTimeUnix = Math.floor(auction.startDateTime.getTime() / 1000);
            const endDateTimeUnix = Math.floor(auction.endDateTime.getTime() / 1000);
            const newEmbed = new EmbedBuilder()
                .setTitle(`${item.itemName}`)
                .setColor(0xcd7f32)
                .addFields(
                    { name: 'Quantity:', value: `${item.quantity}`, inline: true },
                    { name: 'Starting Price:', value: `${auction.startPrice} 🪙`, inline: true },
                    { name: 'Highest Bid:', value: `${auction.currentPrice} 🪙`, inline: true },
                    { name: 'Start:', value: `<t:${startDateTimeUnix}:f>`, inline: true },
                    { name: 'End:', value: `<t:${endDateTimeUnix}:f>`, inline: true },
                    { name: 'Auctioneer:', value: `${userMention(auction.userID)}`, inline: false },
                )
                .setFooter({ text: `Auction ID: ${auction.id}` });

            if (auction.attachmentURL) {
                newEmbed.setImage(auction.attachmentURL);
            }

            if (item.description !== 'No description provided') {
                newEmbed.setDescription(item.description);
            }

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('registerAuction')
                    .setLabel('Register')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('placeBid')
                    .setLabel('Bid [5%]')
                    .setStyle(ButtonStyle.Primary),
            );

            const message = await webhookClient.editMessage(auction.messageID, {
                content: `**The Auction is now OPEN!**`,
                username: dahliaName,
                avatarURL: dahliaAvatar,
                embeds: [newEmbed],
                components: [button],
            });

            if (message) return await interaction.reply({
                content: `Your bid was withdrawn.`,
                ephemeral: true,
            });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to place a bid due to an error.' });
        }
    },
};
