const { EmbedBuilder, WebhookClient, userMention, ActionRowBuilder, ButtonBuilder, ButtonStyle, } = require('discord.js');
const { Shop, Order, Guild } = require('../src/db');
const { dahliaAvatar, dahliaName } = require('../src/vars');

const notifyPurchase = async (interaction, guildID, discordID, itemName) => {
    try {
        const guild = await Guild.findOne({ where: { guildID } });
        if (!guild) {
            throw new Error('guild not found');
        }
        if (!guild.webhookChannelID) return;
        if (!guild.webhookId || !guild.webhookToken) {
            const channel = interaction.client.channels.cache.get(guild.webhookChannelID);

            const webhook = await channel.createWebhook({
                name: 'modChannel',
                avatar: dahliaAvatar,
                reason: 'For posting purchases'
            });

            await guild.update({ webhookId: webhook.id, webhookToken: webhook.token });
        }

        const webhookClient = new WebhookClient({ id: guild.webhookId, token: guild.webhookToken });

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
        if (!guild.specialShopWebhookID || !guild.specialShopWebhookToken) {
            const channel = interaction.client.channels.cache.get(guild.specialShopChannelID);

            const webhook = await channel.createWebhook({
                name: 'announcementChannel',
                avatar: dahliaAvatar,
                reason: 'For announcement purchases'
            });

            await guild.update({ specialShopWebhookID: webhook.id, specialShopWebhookToken: webhook.token });
        }

        const webhookClient = new WebhookClient({ id: guild.specialShopWebhookID, token: guild.specialShopWebhookToken });

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

module.exports = { notifyPurchase, purchaseStatus };