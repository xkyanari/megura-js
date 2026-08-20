# /setup

{% hint style="warning" %}
#### Dahlia auto-registers your guild or server to the database as soon as she joins.

Please make sure that she has sufficient permissions for the following channels if you would like to use more features so she can send messages accordingly.

* Audit logs (for setup and role-related events)
* Captcha channel (for Captcha verification)
* Special shop
* Auction house
* Brawl

Required permissions per channel:

* View channel
* Manage webhooks
* Send messages
* Embed links
* Attach files
* Add reactions
* Use external emojis
* Manage messages
* Use application commands
{% endhint %}

This guide assumes that you're a server owner or administrator of a Discord server as we will skip the part on how to add a Discord bot to your server.

Dahlia will ask for the following permissions before authorizing:

* Manage Roles
* Manage Channels
* Kick Members
* Ban Members
* Create Invite
* View Audit Log
* View Channels
* Send Messages
* Manage Messages
* Embed Links
* Attach Files
* Use External Emojis
* Use External Stickers
* Use Application Commands

### Steps to set up the bot

1. **(Optional) Confirm the server is registered** - `/setup register`: By default, the server gets added to the database as soon as the bot joins.
2. **Assign a channel for audit logs** - `/setup logs <channel_name>`: This is helpful for checking server setup and role-related events. Dahlia does not log deleted messages or deleted message content. Local log files are removed after 30 days.
3. **Setup CAPTCHA for verifying users** - `/setup captcha <channel_name> <role_name>`: It saves the channel and role info assigned (and can be overwritten by running the command again) in the database to execute the server rules.
4. **Set server rules** - `/setup rules`: This will show a pop-up where you can enter your server introduction, rules, and closing. There's a character limit for text as indicated on the pop-up. You can add emojis or follow formatting used on Discord (e.g., **TEXT** for bold, _TEXT_ for italic, etc.).
5. **Deploy CAPTCHA** - `/setup deploy`: This will attempt to send a message to the CAPTCHA channel you set. Please make sure the channel is visible to the users you want to verify and that Dahlia can send messages there. CAPTCHA should be completed through the verification interaction shown by Dahlia. Typed-answer verification in public channels is not supported while the bot runs without Message Content intent.
6. **(Optional) Assign factions** - `/setup factions <margaretha_role> <cerberon_role>`: Assign factions for the Margaretha and Cerberon "sub-guild" per community server. Users with no factions will be assigned as "Wanderer".
7. **Create a whitelist shop** - `/setup shop <channel_name>`: This is for those who want to have their own whitelist shop in exchange for tokens. Available for Enterprise accounts only.

If you no longer want to use Dahlia's moderation tools, you can simply run `/setup disable`. This resets all your information from the database.

{% hint style="info" %}
**Margaretha** and **Cerberon** are placeholder faction names to represent each "sub-guild" per community server. That being said, you can assign your own role name. They are also optional if you do not want to participate on factions or the game itself. Users with no factions will be assigned as "Wanderer".

In rankings, this will show which "faction" has more active members per community.
{% endhint %}

This guide is cross-posted from GitHub: [https://github.com/xkyanari/megura-js/blob/main/docs/setup.md](../../setup.md)
