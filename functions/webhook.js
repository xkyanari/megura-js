const { EmbedBuilder, WebhookClient, userMention, ActionRowBuilder, ButtonBuilder, ButtonStyle, } = require('discord.js');
const { Shop, Order, Guild, Auction } = require('../src/db');
const { dahliaAvatar, dahliaName } = require('../src/vars');

const notifyPurchase = async (interaction, guildID, discordID, itemName) => {
    try {
        const guild = await Guild.findOne({ where: { guildID } });
        if (!guild) {
            throw new Error('guild not found');
        }
        if (!guild.webhookChannelID) return;
        if (!guild.auctionwebhookId && !guild.auctionwebhookToken) {
            const channel = interaction.client.channels.cache.get(guild.webhookChannelID);

            const webhook = await channel.createWebhook({
                name: 'modChannel',
                avatar: dahliaAvatar,
                reason: 'For posting purchases'
            });

            await guild.update({ auctionwebhookId: webhook.id, auctionwebhookToken: webhook.token });
        }

        const webhookClient = new WebhookClient({ id: guild.auctionwebhookId, token: guild.auctionwebhookToken });

        const item = await Shop.findOne({ where: { itemName } });
        if (item) {
            const embed = new EmbedBuilder()
                .setTitle('Item Purchased')
                .setColor(0xcd7f32)
                .setDescription(`Request from: ${userMention(discordID)}\nItem Name: ${itemName}\nQuantity: 1`);

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('completed')
                    .setEmoji('✅')
                    .setLabel('Completed')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('processing')
                    .setEmoji('🔄')
                    .setLabel('Processing')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('cancelled')
                    .setEmoji('❎')
                    .setLabel('Cancelled')
                    .setStyle(ButtonStyle.Danger),
            );

            const message = await webhookClient.send({
                content: `${userMention(discordID)} just purchased an item!`,
                username: dahliaName,
                avatarURL: dahliaAvatar,
                embeds: [embed],
                components: [button],
            });

            await Order.create({
                guildID,
                discordID,
                item_ID: item.item_ID,
                itemName: itemName,
                status: 'pending',
                messageID: message.id,
            });
        }
    } catch (error) {
        console.error(error);
    }
};

const purchaseStatus = async (interaction, guildID, discordID, itemName, status) => {
    try {
        const guild = await Guild.findOne({ where: { guildID } });
        if (!guild) {
            throw new Error('guild not found');
        }
        if (!guild.specialShopChannelID) return;
        if (!guild.specialShopauctionwebhookId && !guild.specialShopauctionwebhookToken) {
            const channel = interaction.client.channels.cache.get(guild.specialShopChannelID);

            const webhook = await channel.createWebhook({
                name: 'announcementChannel',
                avatar: dahliaAvatar,
                reason: 'For announcement purchases'
            });

            await guild.update({ specialShopauctionwebhookId: webhook.id, specialShopauctionwebhookToken: webhook.token });
        }

        const webhookClient = new WebhookClient({ id: guild.specialShopauctionwebhookId, token: guild.specialShopauctionwebhookToken });

        const embed = new EmbedBuilder()
            .setTitle(`Order ${status}`)
            .setColor(0xcd7f32)
            .setDescription(`Your order for \`${itemName}\` is now ${status}!`);

        await webhookClient.send({
            content: `${userMention(discordID)}`,
            username: dahliaName,
            avatarURL: dahliaAvatar,
            embeds: [embed],
        });
    } catch (error) {
        console.error(error);
    }
};

const auctionStatus = async (interaction, guildID, discordID, item, auction) => {
    try {
        const guild = await Guild.findOne({ where: { guildID } });
        if (!guild) {
            throw new Error('guild not found');
        }
        if (!guild.auctionChannelID) return;
        if (!guild.auctionwebhookId && !guild.auctionwebhookToken) {
            const channel = interaction.client.channels.cache.get(guild.auctionChannelID);

            const webhook = await channel.createWebhook({
                name: 'auctionChannel',
                avatar: dahliaAvatar,
                reason: 'For announcements related to auctions'
            });

            await guild.update({ auctionwebhookId: webhook.id, auctionwebhookToken: webhook.token });
        }

        const webhookClient = new WebhookClient({ id: guild.auctionwebhookId, token: guild.auctionwebhookToken });

        const startDateTimeUnix = Math.floor(auction.startDateTime.getTime() / 1000);
        const endDateTimeUnix = Math.floor(auction.endDateTime.getTime() / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`${item.itemName}`)
            .setColor(0xcd7f32)
            .addFields(
                { name: 'Quantity:', value: `${item.quantity}`, inline: true },
                { name: 'Starting Price:', value: `${auction.startPrice} 🪙`, inline: true },
                { name: 'Highest Bid:', value: `${auction.currentPrice} 🪙`, inline: true },
                { name: 'Start:', value: `<t:${startDateTimeUnix}:f>`, inline: true },
                { name: 'End:', value: `<t:${endDateTimeUnix}:f>`, inline: true },
                { name: 'Auctioneer:', value: `${userMention(discordID)}`, inline: false },
            )
            .setFooter({ text: `Auction ID: ${auction.id}` });

        if (auction.attachmentURL) {
            embed.setImage(auction.attachmentURL);
        }

        if (item.description !== 'No description provided') {
            embed.setDescription(item.description);
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
            new ButtonBuilder()
                .setCustomId('withdrawBid')
                .setLabel('Withdraw')
                .setStyle(ButtonStyle.Danger),
        );

        const message = await webhookClient.send({
            content: `**The Auction is now OPEN!**`,
            username: dahliaName,
            avatarURL: dahliaAvatar,
            embeds: [embed],
            components: [button],
        });

        await Auction.update({ messageID: message.id }, { where: { id: auction.id } });
    } catch (error) {
        console.error(error);
    }
};

module.exports = { notifyPurchase, purchaseStatus, auctionStatus };