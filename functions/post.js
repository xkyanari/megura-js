const { PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { TWITTER_BEARER_TOKEN } = require('../config.json');
const { TwitterApi } = require('twitter-api-v2');
const { Raid } = require('../src/db');

module.exports = async (interaction, channel, role) => {
    const message = interaction.client.channels.cache.get(channel);
    const roleMention = `<@&${role}>`;

    const botPermissions = message.permissionsFor(interaction.client.user);
    if (!botPermissions.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) return await interaction.reply({ content: `I don't seem have permissions to send a message on that channel.`, ephemeral: true });

    try {
        const twitterClient = new TwitterApi(TWITTER_BEARER_TOKEN);
        const tweetURL = interaction.options.getString('tweet');
    
        const tweetId = tweetURL.match(/(\d+)/)[0];
    
        const tweet = await twitterClient.v2.singleTweet(tweetId, {
            expansions: [
                'author_id',
                'referenced_tweets.id',
                'entities.mentions.username',
                'attachments.media_keys'
            ],
            'tweet.fields': [
                'created_at',
                'public_metrics',
                'referenced_tweets',
                'text'
            ],
            'user.fields': [
                'name',
                'profile_image_url',
                'username',
                'verified'
            ],
            'media.fields': [
                'url'
            ]
        });
    
        const mediaKey = tweet.includes?.media?.[0]?.media_key;
        const imageUrl = mediaKey ? tweet.includes.media.find(media => media.media_key === mediaKey).url : null;
    
        const embed = new EmbedBuilder()
            .setColor('#1DA1F2')
            .setTitle(`Tweet by ${tweet.includes.users[0].name}`)
            .setDescription(tweet.data.text)
            .setURL(`https://twitter.com/${tweet.includes.users[0].username}/status/${tweet.data.id}`)
            .setTimestamp(new Date(tweet.data.created_at))
            .setFooter({ text: `Tweet ID: ${tweet.data.id}`, iconURL: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'});
        
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
                    .setStyle(ButtonStyle.Secondary)
        );
    
        await message.send({ content: roleMention, embeds: [embed], components: [button] });
        await Raid.create({ tweetUrlID: tweetId, postedBy: interaction.member.id, postedIn: interaction.guild.id });
        await interaction.reply({ content: `Raid tweet posted.`, ephemeral: true });
    } catch (error) {
		console.log(error);
    }
};