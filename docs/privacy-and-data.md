# 🔐 Privacy and Data

Dahlia is designed to run without Discord's privileged Message Content, Server Members, or Presence gateway intents.

This means Dahlia does not scan normal channel conversations, does not track users' presence or activity status, and does not rely on the full server member list. Users interact with Dahlia through slash commands, buttons, select menus, modals, and other explicit Discord interactions.

## Data Dahlia stores

Dahlia stores the data needed to operate server tools and game features:

* Discord user IDs, guild IDs, channel IDs, role IDs, and message IDs supplied through bot interactions
* Character names and player profiles
* Player stats, levels, experience, balances, inventory, shop purchases, and rewards
* Battle, duel, brawl, and auction activity
* Server setup settings such as log channels, CAPTCHA channels, verification roles, rules, shop channels, and faction roles
* Timestamps related to gameplay, setup, and bot activity

## Message content

Dahlia does not collect normal channel message text for commands, AI chat, or deleted-message logging. Legacy message-prefix commands and open channel AI chat are disabled.

## Retention

Local log files are removed after 30 days.

Game and server configuration data may be kept while it is needed to provide bot features, maintain player progress, prevent abuse, or support server setup.

## AI training

Message content and gameplay data are not used to train machine learning or AI models.

## Deletion requests

Users can request deletion of their activity or player data through the support server listed by Dahlia's `/support` command. Include your Discord user ID and, when relevant, the server/guild ID so the request can be located.

Server administrators can remove server configuration data by using `/setup disable`.
