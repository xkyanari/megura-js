const { EmbedBuilder, WebhookClient, userMention, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Shop, Order, Guild } = require('../src/db');
const { dahliaAvatar, dahliaName } = require('../src/vars');

const changeChannel = async (interaction, guildID, channelID, fieldsToUpdate) => {
	try {
		const channel = interaction.client.channels.cache.get(channelID);

		// Fetch all existing webhooks in the channel
		const existingWebhooks = await channel.fetchWebhooks();

		// Delete all existing webhooks
		for (const [, webhook] of existingWebhooks) {
			await webhook.delete();
		}

		// Create a new webhook
		const webhook = await channel.createWebhook({
			name: fieldsToUpdate.webhookName,
			avatar: dahliaAvatar,
			reason: fieldsToUpdate.webhookReason,
		});

		await Guild.update({
			[fieldsToUpdate.channelField]: channelID,
			[fieldsToUpdate.webhookIDField]: webhook.id,
			[fieldsToUpdate.webhookTokenField]: webhook.token,
		}, {
			where: { guildID: guildID },
		});

		return webhook;

	}
	catch (error) {
		console.error(error);
	}
};

const notifyPurchase = async (guildID, discordID, itemName) => {
	try {
		const guild = await Guild.findOne({ where: { guildID } });
		if (!guild) {
			throw new Error('guild not found');
		}
		if (!guild.webhookChannelID || (!guild.webhookId && !guild.webhookToken)) return;

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
	}
	catch (error) {
		console.error(error);
	}
};

const purchaseStatus = async (guildID, discordID, itemName, status) => {
	try {
		const guild = await Guild.findOne({ where: { guildID } });
		if (!guild) {
			throw new Error('guild not found');
		}
		if (!guild.specialShopChannelID || (!guild.specialShopWebhookID && !guild.specialShopWebhookToken)) return;

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
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = { notifyPurchase, purchaseStatus, changeChannel };