# Setup Command

Dahlia is a versatile bot for any kind of Discord servers. While it boasts as a storytelling bot, she can also help with server management, including audit logs, verification with Captcha, Whitelist shop, Twitter raids, and roles.

However, Dahlia does not scan servers for permissions and privileges by default, as she does not require the administrator role. That means you will have to check she can see the channels and messages so she can interact with you.

She can be given administrator role but please take caution. Doing this will override a lot of permission checks from her and be able to execute commands if left unchecked. For example, she can delete channels without confirmation if you executed a command such as `/close`. This is irreversible!

Please note that Dahlia is still in beta version and improves over time. If you encounter any errors while executing a command, please contact us immediately.

Steps to set up the bot:

1. (Optional) Confirm the server is registered - `/setup register`: By default, the server gets added to the database as soon as the bot joins.

2. Assign a channel for audit logs - `/setup logs <channel_name>`: This is helpful for checking which messages were deleted, roles updated, and people joining and leaving the server. It also generates a log file in the event that the server gets compromised for investigation.

3. Setup CAPTCHA for verifying users - `/setup captcha <channel_name> <role_name>`: It saves the channel and role info assigned (and can be overwritten by running the command again) in the database to execute the server rules.

4. Set server rules - `/setup rules`: This will show a pop-up where you can enter your server introduction, rules, and closing. There's a character limit for text as indicated on the pop-up. You can add emojis or follow formatting used on Discord (e.g., **TEXT** for bold, _TEXT_ for italic, etc.).

5. Deploy CAPTCHA - `/setup deploy`: This will attempt to send a message to the CAPTCHA channel you set. Please make sure the channel is accessible to everyone, including Dahlia, and that they can send messages to it. When people click the "Verify" button, the bot sends them an ephemeral message with the CAPTCHA image visible only to them. They will need to give their CAPTCHA answer by sending it to the channel to compare. Whether it's valid or not, she will delete the user's message, including the CAPTCHA image, to avoid clutter in the channel.

6. (Optional) Assign factions - `/setup factions <margaretha_role> <cerberon_role>`: Assign factions for the Margaretha and Cerberon "sub-guild" per community server. Users with no factions will be assigned as "Wanderer".

7. (Optional) Login to the server's Twitter account - `/setup twitter`: If you want to cross-post from Discord to Twitter in order to promote your Discord server, this one is for you. Only the server owner can set this up compared to other /setup commands that can be run by admins. The token gets saved to the database, so even moderators with proper privileges can tweet on your behalf.

8. Create a whitelist shop - `/setup shop <channel_name>`: This is for those who want to have their own whitelist shop for holders in exchange for tokens. Available for Enterprise accounts only.

If you no longer want to use Dahlia's moderation tools, you can simply run `/setup disable`. This deletes all your information from the database.

## Important Notes

Margaretha and Cerberon are placeholder faction names to represent each "sub-guild" per community server. That being said, you can assign your own role name. They are also optional if you do not want to participate on factions or the game itself. Users with no factions will be assigned as "Wanderer".

In rankings, this will show which "faction" has more active members per community.

The `/setup twitter` command allows the server owner (the person who set up the server) to log in as the server's Twitter account from Discord. The tokens then get stored in the server settings. This ensures that the server's Twitter account is secure and that there are no conflicts or confusion regarding who has access to it.

Moreover, **no more than one Discord user can login to one Twitter account.** These restrictions were placed in the event a server was compromised and the server's Twitter account will not be included. Twitter logins are tracked from when they were created on the table and when they were updated for data integrity and security purposes.

It's also important to note that since users need only register themselves once, they can join raids on any server that has the Megura bot.
