# Privacy Policy

Last updated: 2026-08-19

This Privacy Policy explains how Dahlia, the Megura Discord bot, uses Discord data.

## Data Dahlia Uses

Dahlia may process:

- Discord user IDs, usernames, guild IDs, channel IDs, role IDs, and message IDs.
- Message content for legacy text commands, AI chat responses, verification/captcha handling, and moderation logs.
- Member join/leave and role update events for server moderation logs.
- Game profile, inventory, shop, auction, brawl, raid, wallet, and server configuration records stored in the bot database.

## Message Content

Dahlia reads message content when:

- A user runs a text command using the configured prefix.
- A user starts or continues AI chat with the configured chat prefix.
- A server uses verification/captcha channels where user answers are compared and then deleted.
- A server enables moderation logs, including deleted-message logs.

AI chat messages may be sent to OpenAI to generate a reply. Message content is not used to train machine learning or AI models by Megura.

Deleted-message content may be posted to the server's configured moderation log channel and written to local daily log files for moderation transparency.

## Data Storage

The bot is hosted on infrastructure where its database also exists. Some Discord-related data is stored off-platform in that database for bot features, including server configuration, player/game records, auction records, raid records, and bot feature state.

Local moderation log files are automatically removed after 30 days.

## Opt-Out

Users can stop AI chat by sending the configured chat prefix followed by `stop`.

Message content processing cannot be disabled per user while using text commands, verification/captcha channels, moderation logging, or AI chat features. Server admins can disable configured bot features with `/setup disable` where supported.

## Third-Party Services

Dahlia may use third-party services, including OpenAI for AI chat responses and Twitter/X APIs for raid features.

## Contact

For privacy questions or removal requests, contact the Megura/Dahlia maintainers through the support server listed in `/support`.
