# Setup Command

Dahlia is a versatile bot for Discord servers. While it is primarily a storytelling bot, she can also help with server management, including setup logs, verification with Captcha, whitelist shops, and roles.

However, Dahlia does not scan servers for permissions and privileges by default, as she does not require the administrator role. Dahlia also does not require Discord's privileged Message Content, Server Members, or Presence gateway intents. That means she uses slash commands and explicit interactions instead of reading normal channel conversations, member list updates, or presence activity.

She can be given administrator role but please take caution. Doing this will override a lot of permission checks from her and be able to execute commands if left unchecked. For example, she can delete channels without confirmation if you executed a command such as `/close`. This is irreversible!

Please note that Dahlia is still in beta version and improves over time. If you encounter any errors while executing a command, please contact us immediately.

## Steps to set up the bot

1. (Optional) Confirm the server is registered - `/setup register`: By default, the server gets added to the database as soon as the bot joins.

2. Assign a channel for audit logs - `/setup logs <channel_name>`: This is helpful for checking server setup and role-related events. Dahlia does not log deleted messages or deleted message content. Local log files are removed after 30 days.

3. Setup CAPTCHA for verifying users - `/setup captcha <channel_name> <role_name>`: It saves the channel and role info assigned (and can be overwritten by running the command again) in the database to execute the server rules.

4. Set server rules - `/setup rules`: This will show a pop-up where you can enter your server introduction, rules, and closing. There's a character limit for text as indicated on the pop-up. You can add emojis or follow formatting used on Discord (e.g., **TEXT** for bold, _TEXT_ for italic, etc.).

5. Deploy CAPTCHA - `/setup deploy`: This will attempt to send a message to the CAPTCHA channel you set. Please make sure the channel is visible to the users you want to verify and that Dahlia can send messages there. CAPTCHA should be completed through the verification interaction shown by Dahlia. Typed-answer verification in public channels is not supported while the bot runs without Message Content intent.

6. (Optional) Assign factions - `/setup factions <margaretha_role> <cerberon_role>`: Assign factions for the Margaretha and Cerberon "sub-guild" per community server. Users with no factions will be assigned as "Wanderer".


7. Create a whitelist shop - `/setup shop <channel_name>`: This is for those who want to have their own whitelist shop for holders in exchange for tokens. Available for Enterprise accounts only.

If you no longer want to use Dahlia's moderation tools, you can simply run `/setup disable`. This deletes all your information from the database.

## Important Notes

Margaretha and Cerberon are placeholder faction names to represent each "sub-guild" per community server. That being said, you can assign your own role name. They are also optional if you do not want to participate on factions or the game itself. Users with no factions will be assigned as "Wanderer".

In rankings, this will show which "faction" has more active members per community.
