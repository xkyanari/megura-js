# Messinia Graciene: Project DAHLIA

![Project DAHLIA banner](https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png)

Dahlia is a Discord.js v14 bot for Project DAHLIA, a text-based Discord RPG with server utility features. Users interact with Dahlia through slash commands, buttons, menus, and modals.

Dahlia is designed to run without Discord's privileged Message Content, Server Members, or Presence gateway intents. Open channel AI chat and legacy text commands are disabled.

[![Support us on Ko-fi!](https://res.cloudinary.com/dnjaazvr7/image/upload/c_thumb,w_200,g_face/v1684692937/megura/61e11d503cc13747866d338b_Button-2-p-500_nvb2aa.png)](https://ko-fi.com/megura)

🔸[Docs](https://docs.megura.xyz)🔸[Support Server](https://discord.gg/X9eEW6yuhq)🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)🔸

## Table of Contents

- [Packages](#packages)
- [Pre-requisites](#pre-requisites)
- [List of Discord bot features (work in progress)](#list-of-discord-bot-features-work-in-progress)
- [Installation](#installation)
- [Discord intents](#discord-intents)
- [Commands](#commands-work-in-progress)
- [Contributing](#contributing)
- [License](#license)

## Packages

- Node.js
- Discord.js v14
- Captcha-canvas
- Cloudinary
- MySQL 8.0
- Redis
- Sequelize

## Pre-requisites

Before running the bot, you will need the following:

- **Node.js 18.17 or newer**: Discord.js v14 and its REST dependencies require a modern Node.js runtime. You can download and install Node.js from the official website at https://nodejs.org.
- **Discord Bot Token**: You will need a Discord bot token to authenticate your bot with the Discord API. You can obtain a token by creating a new bot application on the Discord Developer Portal at https://discord.com/developers/applications.
- **MySQL 8.0 database**: Dahlia stores guild settings, player profiles, inventory, wallet data, auctions, brawls, and other gameplay state in MySQL through Sequelize.
- **Redis**: Required for cooldown/rate tracking, Bull queues, and temporary CAPTCHA state.
- **Cloudinary credentials**: Required for uploading temporary CAPTCHA images.
- **OpenAI API Key (optional)**: The package is still present for future AI features, but open channel AI chat is currently disabled while the bot avoids Message Content intent.

## List of Discord bot features (work in progress)

- [x] Verification with Captcha
- [ ] Create and manage Giveaways
- [ ] Create and manage Raffles
- [x] Post announcements for orders, etc.
- [x] Mini games (arena, etc.)
- [ ] View server setup logs
- [ ] Create and manage Reaction roles
- [ ] Create and manage Forms
- [ ] Send Auto Messages/webhooks
- [x] Storytelling
- [x] Creating and closing private channels
- [ ] Scheduling events
- [ ] Ticketing system
- [ ] Whitelisting
- [ ] Sales tracking
- [x] Slash-command RPG profile and inventory system
- [x] Auctions and brawls
- [ ] Exploration mode
- [ ] World bosses

All of these may not require having administrator role on the bot for security, but they are subject to change without prior notice.

## Installation

To install and run the project, follow these steps:

1. Clone this repository to your local machine using `git clone https://github.com/xkyanari/megura-js.git`
2. Navigate to the project directory in your terminal
3. Install dependencies using `npm install`
4. Rename `config-example.json` to `config.json` and update the values for Discord, MySQL, Redis, Cloudinary, and other services you enable.
5. Rename `assets/features-example.json` to `src/feature.js` if you are using the feature toggle file.
6. Update the database host/settings in `src/db.js` or your local equivalent.
7. (Optional) Chapters can be uploaded in `chapters/`. Otherwise, the bot will simply load the placeholder stories found in `samples/`.

## Discord intents

Dahlia currently uses non-privileged gateway intents only:

- Guilds
- Guild Messages
- Guild Voice States
- Guild Message Reactions
- Guild Webhooks
- Direct Messages
- Direct Message Typing
- Direct Message Reactions

Dahlia does not request Message Content, Server Members, or Presence intents. Features that previously relied on normal message text have been removed or converted to slash commands, buttons, and modals.

## Commands (work in progress)

- `/attack`: Initiate attack against a random monster.
- `/auction`: Start, view, or manage auction activity.
- `/brawl`: Start or join a brawl challenge.
- `/buy`: Lets player to buy items in bulk.
- `/changenick`: Updates player name.
- `/checkprofile`: Check whether your player profile exists.
- `/close`: Closes a portal prematurely.
- `/daily`: Do a random quest to increase/decrease stats or gain Iura.
- `/duel`: Initiate a duel against another player.
- `/equip`: Equip an inventory item.
- `/info`: Shows the list of commands.
- `/inventory`: Opens your inventory.
- `/invite`: Shows the bot invite link.
- `/iura`: Check your wallet or bank.
- `/open <name of channel>`: Creates a private channel, auto-closes in 10 minutes.
- `/privacy`: Shows the privacy notice.
- `/profile`: Show profile of a user (blank for self).
- `/ranks`: Show leaderboards.
- `/requestduel`: Respond to a duel request.
- `/reset`: Delete voyager profile.
- `/sendgift`: Send a gift to another player.
- `/setup`: Setup server for moderation tools.
- `/shop`: Opens the Item Shop.
- `/specialshop`: Opens the Special Shop.
- `/start`: Initiate creating own character.
- `/support`: Shows support server information.
- `/transfer`: Transfer IURA to another user.
- `/unequip`: Unequip an item.
- `/vote`: Shows voting information.

## Contributing

If you'd like to contribute to the project, please follow these steps:

1. Fork the project
2. Create a new branch (`git checkout -b feature`)
3. Make your changes and commit them (`git commit -am 'Add feature'`)
4. Push to the branch (`git push origin feature`)
5. Create a new Pull Request

## License

This project is licensed under the [GPL-3.0 license](https://opensource.org/license/gpl-3-0/).
