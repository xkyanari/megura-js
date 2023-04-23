const { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET } = require('../../config.json');
const { TwitterApi } = require('twitter-api-v2');
const { Guild, Tweet } = require('../../src/db');

/**
 * Text and emojis are accepted.
 */

module.exports = {
    name: 'tweet',
    description: 'Post tweets to server Twitter account.',
    usage: '<message>',
    async execute(message, args) {
        let messageContent = args.join(' ');
        if (!messageContent) return message.reply({ content: 'Please provide a tweet.' });
        if (messageContent.length > 280) return message.reply({ content: `Tweet cannot exceed 280 characters.` });

        const guild = await Guild.findOne({ where: { guildID: message.guild.id }});

        if (!guild || !guild.twitterID) return await message.reply({ content: `Please register the guild first.` });

        const now = new Date();
        if (guild.expirationTime && guild.expirationTime < now) {
            const twitterClient = new TwitterApi({ clientId: TWITTER_CLIENT_ID, clientSecret: TWITTER_CLIENT_SECRET });

            const { client: refreshedClient, accessToken, refreshToken: newRefreshToken } = await twitterClient.refreshOAuth2Token(guild.refreshToken);

            guild.accessToken = accessToken;
            guild.refreshToken = newRefreshToken;
            await guild.save();

            const rwClient = refreshedClient.readWrite;

            if (message.attachments.size > 0) {
                return await message.reply({ content: `I'm unable to include images on tweets right now. Please try again. I accept only text and emojis at the moment.`});
            }

            const { data: createdTweet } = await rwClient.v2.tweet(messageContent);
            const tweetURL = `https://twitter.com/${guild.username}/status/${createdTweet.id}`;
            
            await Tweet.create({ postedby: message.member.id, tweetID: createdTweet.id, tweetURL });
            await message.reply({ content: `Tweet sent!\n\nTweet URL: ${tweetURL}` });
        } else {
            const twitterClient = new TwitterApi(guild.accessToken);
            const rwClient = twitterClient.readWrite;

            if (message.attachments.size > 0) {
                // const imageUrl = message.attachments.first().url;
                // messageContent += `${imageUrl}`;
                return await message.reply({ content: `I'm unable to include images on tweets right now. Please try again. I accept only text and emojis at the moment.`});
            }

            const { data: createdTweet } = await rwClient.v2.tweet(messageContent);
            const tweetURL = `https://twitter.com/${guild.username}/status/${createdTweet.id}`;

            await Tweet.create({ postedby: message.member.id, tweetID: createdTweet.id, tweetURL });
            await message.reply({ content: `Tweet sent!\n\nTweet URL: ${tweetURL}` });
        }
    },
};