# Raid Command

The Raid command is used for tracking retweets and likes from Discord users. This is helpful for analytical purposes and for engaging with users who see the tweets posted on your Discord server.

The bot will **NOT**:
- Un-like tweets for you.
- Un-retweet or tweet for you.
- View or send any DMs for you.

You can refer to `commands/slash-commands/raid.js` for more information to confirm. Access and refresh tokens are hashed when stored in the database for security. **We do not save passwords or email addresses.**

The Raid command has six subcommands:

1. Join
   - Usage: `/raid join`
   - Description: Login to Twitter. Users can use this so they can authenticate with their Twitter account through Discord. This will allow them to RT and Like tweets you will announce on your server.

2. Check
   - Usage: `/raid check <tweet_URL>`
   - Description: Check the Discord users who retweeted and liked the specified tweets.
   - Parameters:
     - `tweet`: The URL or link of the tweet to check (required).

3. Post
   - Usage: `/raid post <tweet_URL>`
   - Description: Post a tweet for users to RT and Like. By default, administrators have the capability to do this. They can simply copy and paste the tweet's URL so it will embed a message for users to RT and like.
   - Parameters:
     - `tweet`: The URL or link of the tweet to post (required).

4. Role
   - Usage: `/raid role <role_name>`
   - Description: Select a role for raiders to receive notifications. This intended so only raiders and people wanting to know about the announcements.
   - Parameters:
     - `name`: The name of the role to assign to raiders (required).

5. Channel
   - Usage: `/raid channel <channel_name>`
   - Description: Select a channel to post tweets for raids.
   - Parameters:
     - `name`: The name of the channel to post tweets for raids (required).

6. Remove
   - Usage: `/raid remove`
   - Description: Allows the user to remove the link to their Twitter account.