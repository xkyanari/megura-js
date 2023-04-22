const { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET } = require('../../config.json');
const { TwitterApi } = require('twitter-api-v2');
const { Raid, Twitter } = require('../../src/db');

module.exports = {
    data: {
        name: `like`,
    },
    async execute(interaction) {
        const tweetId = interaction.message.embeds[0].footer.text.split(': ')[1];

        const twitterUser = await Twitter.findOne({ where: { discordID: interaction.member.id }});

        if (!twitterUser) return interaction.reply({ content: `Please login using \`/raid login\` first.`, ephemeral: true });

        // Check if the access token has expired
        const now = new Date();
        if (twitterUser.expirationTime && twitterUser.expirationTime < now) {
            // Authenticate to Twitter API to refresh token
            const twitterClient = new TwitterApi({ clientId: TWITTER_CLIENT_ID, clientSecret: TWITTER_CLIENT_SECRET });

            const { client: refreshedClient, accessToken, refreshToken: newRefreshToken } = await twitterClient.refreshOAuth2Token(twitterUser.refreshToken);

            twitterUser.accessToken = accessToken;
            twitterUser.refreshToken = newRefreshToken;
            await twitterUser.save();

            const rwClient = refreshedClient.readWrite;

            const like = await rwClient.v2.like(twitterUser.twitterID, tweetId);
            if (like) {
                const raidTweet = await Raid.findOne({ where: { tweetUrlID: tweetId } });
                const likes = raidTweet.likers;
                if (!likes.includes(interaction.member.id)) {
                    likes.push(interaction.member.id);
                    raidTweet.likers = likes;
                    await raidTweet.save();
                    await interaction.reply({content: `Liked!`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `You already liked this tweet!`, ephemeral: true });
                }
            }
        } else {
            const twitterClient = new TwitterApi(twitterUser.accessToken);
            const rwClient = twitterClient.readWrite;

            const like = await rwClient.v2.retweet(twitterUser.twitterID, tweetId);
            if (like) {
                const raidTweet = await Raid.findOne({ where: { tweetUrlID: tweetId } });
                const likes = raidTweet.likers;
                if (!likes.includes(interaction.member.id)) {
                    likes.push(interaction.member.id);
                    raidTweet.likers = likes;
                    await raidTweet.save();
                    await interaction.reply({content: `Liked!`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `You already liked this tweet!`, ephemeral: true });
                }
            }
        }
    }
};