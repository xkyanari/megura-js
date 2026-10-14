const { EmbedBuilder, WebhookClient, userMention } = require('discord.js');
const { Guild } = require('../src/db');
const { dahliaAvatar, dahliaName } = require('../src/vars');

// Errors (e.g. missing Manage Webhooks) propagate so the command's caller,
// and the global interaction handler, can tell the admin what went wrong.
const changeChannel = async (interaction, guildID, channelID, fieldsToUpdate) => {
	const channel = interaction.client.channels.cache.get(channelID)
		?? await interaction.client.channels.fetch(channelID);

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

module.exports = { changeChannel, brawlStatus };
