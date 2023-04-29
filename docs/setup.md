# Setup Command

Administrators will have complete control on how Dahlia will work around the server particularly with the audit logs, verification with Captcha, Whitelist shop, Twitter raids and roles. For updating the `/raid` command and adding story chapters, please refer to raid.md and chapters.md, respectively.

The Setup command has eight subcommands:

1. Register
   - Usage: `/setup register`
   - Description: Register guild.

2. Disable
   - Usage: `/setup disable`
   - Description: Disable the verification.

3. Logs
   - Usage: `/setup logs <channel_name>`
   - Description: Assign channel for audit logs.
   - Parameters:
     - `channel`: The name of the channel to log captcha attempts (required, must be a text channel).

4. Captcha
   - Usage: `/setup captcha <channel_name> <role_name>`
   - Description: Setup CAPTCHA.
   - Parameters:
     - `channel`: The name of the channel to post the verification message (required, must be a text channel).
     - `role`: The name of the role to assign to verified users (required).

5. Shop
   - Usage: `/setup shop <channel_name>`
   - Description: Whitelist Shop.
   - Parameters:
     - `channel`: The name of the channel for the Whitelist Shop (required, must be a text channel).

6. Deploy
   - Usage: `/setup deploy`
   - Description: Deploy messages for respective channels (audit logs, verification with Captcha, Whitelist shop, etc.).

7. Factions
   - Usage: `/setup factions <margaretha_role> <cerberon_role>`
   - Description: Assign factions.
   - Parameters:
     - `margaretha`: The name of the role for the Margaretha faction (required).
     - `cerberon`: The name of the role for the Cerberon faction (required).

8. Twitter
   - Usage: `/setup twitter`
   - Description: Log ins to the server's Twitter account (if any).

## Important Notes

> Margaretha and Cerberon are placeholder faction names to represent each "sub-guild" per community server. That being said, you can assign your own role name. They are also optional if you do not want to participate on factions or the game itself. Users with no factions will be assigned as "Wanderer".
> 
> In rankings, this will show which "faction" has more active members per community.

> The `/setup twitter` command allows the server owner (the person who set up the server) to log in as the server's Twitter account from Discord. The tokens then get stored in the server settings. This ensures that the server's Twitter account is secure and that there are no conflicts or confusion regarding who has access to it.
> 
> Moreover, **no more than one Discord user can login to one Twitter account.** These restrictions were placed in the event a server was compromised and the server's Twitter account will not be included. Twitter logins are tracked from when they were created on the table and when they were updated for data integrity and security purposes.
> 
> It's also important to note that since users need only register themselves once, they can join raids on any server that has the Megura bot.