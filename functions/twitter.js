const Keyv = require('keyv');
const { TwitterApi } = require('twitter-api-v2');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, TWITTER_CALLBACK_URL } = require('../config.json');
const { Twitter } = require('../src/db');

/**
 * 
 * According to https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
 * By default, the access token you create through the Authorization Code Flow with PKCE
 * will only stay valid for two hours unless you’ve used the offline.access scope.
 * 
 */


const client = new TwitterApi({ clientId: TWITTER_CLIENT_ID, clientSecret: TWITTER_CLIENT_SECRET });

const keyv = new Keyv();
keyv.on('error', err => console.error('Keyv connection error:', err));

const twitterAuth = async (interaction) => {
    try {
        const twitter = await Twitter.findOne({ where: { discordID: interaction.member.id }});
    
        const { url, codeVerifier, state } = client.generateOAuth2AuthLink(TWITTER_CALLBACK_URL, { scope: [
            'tweet.read', // requirement for retweets
            'tweet.write', // requirement for retweets
            'users.read', // requirement for retweets and likes
            'like.write', // requirement for liking tweets
            'offline.access' // to refresh logins and not asked again
        ] });
    
        await keyv.set(`codeVerifier:${state}`, codeVerifier, 600000);
    
        if (twitter) {
            twitter.codeVerifier = codeVerifier;
            await twitter.save();
        } else {
            await Twitter.create({ discordID: interaction.member.id, codeVerifier });
        }
    
        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Login')
                    .setEmoji('🐦')
                    .setStyle(ButtonStyle.Link)
                    .setURL(url)
        );
    
        const embed = new EmbedBuilder()
            .setDescription(
                `Please click the button below to authenticate with your Twitter account.
                
                Once authenticated, please allow up to 3 mins to check your status.`
            );
        await interaction.reply({ embeds: [embed], components: [button], ephemeral: true });
    } catch (error) {
        console.error(error);
    }
};

const twitterCallback = async (req, res) => {
    const { state, code } = req.query;

    try {
        const codeVerifier = await keyv.get(`codeVerifier:${state}`);

        if (!codeVerifier) {
            return res.status(400).send('You denied the app or your session expired.');
        }

        const storedState = state;

        if (state !== storedState) {
            return res.status(400).send('Stored tokens didn\'t match!');
        }

        const { client: loggedClient, accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({ code, codeVerifier, redirectUri: TWITTER_CALLBACK_URL });

        const { data: userObject } = await loggedClient.v2.me();

        const now = new Date();
        const expiresInMs = expiresIn * 1000;
        const expirationTime = new Date(now.getTime() + expiresInMs);

        await Twitter.update(
            { twitterID: userObject.id, username: userObject.username, accessToken, refreshToken, expiresIn, expirationTime },
            { where: { codeVerifier } }
        );

        await keyv.delete(`codeVerifier:${state}`);

        res.render('twitterSuccess');
    } catch (error) {
        console.error('Error in twitterCallback:', error);
        res.status(500).send('Server error');
    }
};

module.exports = { twitterAuth, twitterCallback };
