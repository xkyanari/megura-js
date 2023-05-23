const {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
} = require("../../config.json");
const { TwitterApi } = require("twitter-api-v2");
const { Raid, Twitter } = require("../../src/db");

/**
 *
 * According to https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 * By default, the access token you create through the Authorization Code Flow with PKCE
 * will only stay valid for two hours unless you’ve used the offline.access scope.
 *
 */

module.exports = {
  data: {
    name: `retweet`,
  },
  async execute(interaction) {
    const tweetId = interaction.message.embeds[0].footer.text.split(": ")[1];

    try {
      const twitterUser = await Twitter.findOne({
        where: { discordID: interaction.member.id },
      });

      if (!twitterUser)
        return interaction.reply({
          content: `Please login using \`/raid join\` first.`,
          ephemeral: true,
        });

      // Check if the access token has expired
      const now = new Date();
      if (twitterUser.expirationTime && twitterUser.expirationTime < now) {
        // Authenticate to Twitter API to refresh token
        const twitterClient = new TwitterApi({
          clientId: TWITTER_CLIENT_ID,
          clientSecret: TWITTER_CLIENT_SECRET,
        });

        const {
          client: refreshedClient,
          accessToken,
          refreshToken: newRefreshToken,
        } = await twitterClient.refreshOAuth2Token(twitterUser.refreshToken);

        twitterUser.accessToken = accessToken;
        twitterUser.refreshToken = newRefreshToken;

        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 2);
        twitterUser.expirationTime = expirationDate;

        await twitterUser.save();

        const rwClient = refreshedClient.readWrite;

        const retweet = await rwClient.v2.retweet(
          twitterUser.twitterID,
          tweetId
        );
        if (retweet) {
          const raidTweet = await Raid.findOne({
            where: { tweetUrlID: tweetId },
          });
          const retweets = raidTweet.retweeters;
          if (!retweets.includes(interaction.member.id)) {
            retweets.push(interaction.member.id);
            raidTweet.retweeters = retweets;
            await raidTweet.save();
            await interaction.reply({ content: `Retweeted!`, ephemeral: true });
          } else {
            await interaction.reply({
              content: `You already retweeted this tweet!`,
              ephemeral: true,
            });
          }
        }
      } else {
        const twitterClient = new TwitterApi(twitterUser.accessToken);
        const rwClient = twitterClient.readWrite;

        const retweet = await rwClient.v2.retweet(
          twitterUser.twitterID,
          tweetId
        );
        if (retweet) {
          const raidTweet = await Raid.findOne({
            where: { tweetUrlID: tweetId },
          });
          const retweets = raidTweet.retweeters;
          if (!retweets.includes(interaction.member.id)) {
            retweets.push(interaction.member.id);
            raidTweet.retweeters = retweets;
            await raidTweet.save();
            await interaction.reply({ content: `Retweeted!`, ephemeral: true });
          } else {
            await interaction.reply({
              content: `You already retweeted this tweet!`,
              ephemeral: true,
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  },
};
