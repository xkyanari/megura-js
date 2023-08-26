const { EmbedBuilder, WebhookClient, userMention, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Shop, Order, Guild, Auction } = require('../src/db');
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

const auctionStatus = async (guildID, discordID, item, auction) => {
	try {
		const guild = await Guild.findOne({ where: { guildID } });
		if (!guild) {
			throw new Error('guild not found');
		}
		if (!guild.auctionChannelID || (!guild.auctionwebhookId && !guild.auctionwebhookToken)) return;

		const webhookClient = new WebhookClient({ id: guild.auctionwebhookId, token: guild.auctionwebhookToken });

		const startDateTimeUnix = Math.floor(auction.startDateTime.getTime() / 1000);
		const endDateTimeUnix = Math.floor(auction.endDateTime.getTime() / 1000);

		const embed = new EmbedBuilder()
			.setTitle(`${item.itemName}`)
			.setColor(0xcd7f32)
			.addFields(
				{ name: 'Quantity:', value: `${item.quantity}`, inline: true },
				{ name: 'Starting Price:', value: `${auction.startPrice / 100000000}🪙`, inline: true },
				{ name: 'Highest Bid:', value: `${auction.currentPrice / 100000000}🪙`, inline: true },
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
				.setCustomId('placeBid1')
				.setLabel('Bid [+0.0033🪙]')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('placeBid2')
				.setLabel('Bid [+0.01🪙]')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId('placeBid3')
				.setLabel('Bid [+0.02🪙]')
				.setStyle(ButtonStyle.Primary),
		);

		const message = await webhookClient.send({
			content: '**The Auction is now OPEN!**',
			username: dahliaName,
			avatarURL: dahliaAvatar,
			embeds: [embed],
			components: [button],
		});

		await Auction.update({ messageID: message.id }, { where: { id: auction.id } });
	}
	catch (error) {
		console.error(error);
	}
};

const brawlStatus = async (guildID, challengerId, acceptorId, status, challengerScore, acceptorScore, listingId) => {
	try {
		const guild = await Guild.findOne({ where: { guildID } });
		if (!guild) {
			throw new Error('guild not found');
		}
		if (!guild.brawlChannelID || (!guild.brawlwebhookId && !guild.brawlwebhookToken)) return;

		const webhookClient = new WebhookClient({ id: guild.brawlwebhookId, token: guild.brawlwebhookToken });

		// Convert scores to emoji strings
		const scoreEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
		const challengerEmojiScore = scoreEmojis[challengerScore];
		const acceptorEmojiScore = scoreEmojis[acceptorScore];

		const embed = new EmbedBuilder()
			.setTitle(`⚔️ Brawl Scoreboard - ${status} ⚔️`)
			.setColor(0xcd7f32)
			.addFields(
				{ name: '🏹 Challenger', value: `${userMention(challengerId)}`, inline: true },
				{ name: 'Score', value: `${challengerEmojiScore} - ${acceptorEmojiScore}`, inline: true },
				{ name: 'Acceptor 🎯', value: `${userMention(acceptorId)}`, inline: true },
			)
			.setFooter({ text: `Listing ID: ${listingId}` });

		await webhookClient.send({
			username: dahliaName,
			avatarURL: dahliaAvatar,
			embeds: [embed],
		});
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = { notifyPurchase, purchaseStatus, auctionStatus, changeChannel, brawlStatus };