const {
	PermissionsBitField,
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const {
	isTestnet,
	website_testnet,
	website,
} = require('../config.json');
const {
	// Raid,
	Guild,
} = require('../src/db');
const { footer } = require('../src/vars');

module.exports = async (interaction, channel, role) => {
	const message = interaction.client.channels.cache.get(channel);
	const roleMention = `<@&${role}>`;

	const botPermissions = message.permissionsFor(interaction.client.user);
	if (
		!botPermissions.has([
			PermissionsBitField.Flags.ViewChannel,
			PermissionsBitField.Flags.SendMessages,
		])
	) {
		return await interaction.reply({
			content: 'I don\'t seem have permissions to send a message on that channel.',
			ephemeral: true,
		});
	}

	try {
		const guildCheck = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});

		if (
			!guildCheck ||
			!guildCheck.twitterChannelID ||
			!guildCheck.raidRoleID
		) {
			return await interaction.reply({
				content: 'Please register the guild first and update your Twitter settings.',
				ephemeral: true,
			});
		}

		const tweetURL = interaction.options.getString('tweet');
		const tweetId = tweetURL.match(/(\d+)/)[0];
		const websiteURL = isTestnet ? website_testnet : website;

		const tweet = fetch(websiteURL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ query: tweetId }),
		});
		console.log(tweet.json());

		const mediaKey = tweet.includes?.media?.[0]?.media_key;
		const imageUrl = mediaKey ?
			tweet.includes.media.find((media) => media.media_key === mediaKey).url :
			null;

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle(`Tweet by ${tweet.includes.users[0].name}`)
			.setDescription(tweet.data.text)
			.setURL(
				`https://twitter.com/${tweet.includes.users[0].username}/status/${tweet.data.id}`,
			)
			.setTimestamp(new Date(tweet.data.created_at))
			.setFooter(footer);

		if (imageUrl !== null) {
			embed.setImage(imageUrl);
		}

		const button = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('retweet')
					.setLabel('RT')
					.setEmoji('🐦')
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('like')
					.setLabel('Like')
					.setEmoji('❤️')
					.setStyle(ButtonStyle.Secondary),
			);

		await message.send({
			content: roleMention,
			embeds: [embed],
			components: [button],
		});
		// await Raid.create({
		// 	tweetUrlID: tweetId,
		// 	postedBy: interaction.member.id,
		// 	postedIn: interaction.guild.id,
		// });
		// await interaction.reply({ content: 'Raid tweet posted.', ephemeral: true });
	}
	catch (error) {
		console.log(error);
	}
};
