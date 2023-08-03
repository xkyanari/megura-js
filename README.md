# Messinia Graciene: Project DAHLIA

![Project DAHLIA banner](https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png)

Dahlia is a state-of-the-art Discord bot that runs on chatGPT and supports both slash and text commands. As an all-rounder bot, she comes with a wide range of utilities, but her main purpose is to serve as a storyteller for a text-based RPG. Dahlia acts as an NPC (non-playable character) in the game, enabling players with supported NFT collections to communicate with her and participate in the game. With her advanced capabilities and cutting-edge technology, Dahlia offers an immersive and engaging experience for players looking to explore the world of text-based RPGs.

[![Support us on Ko-fi!](https://res.cloudinary.com/dnjaazvr7/image/upload/c_thumb,w_200,g_face/v1684692937/megura/61e11d503cc13747866d338b_Button-2-p-500_nvb2aa.png)](https://ko-fi.com/megura)

🔸[Docs](https://docs.megura.xyz)🔸[Support Server](https://discord.gg/X9eEW6yuhq)🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)🔸

## Table of Contents

- [Packages](#packages)
- [Pre-requisites](#pre-requisites)
- [List of Discord bot features (work in progress)](#list-of-discord-bot-features-work-in-progress)
- [Installation](#installation)
- [Commands](#commands-work-in-progress)
- [Contributing](#contributing)
- [License](#license)

## Packages

- Node.js
- Alchemy SDK
- Solscan API
- Discord.js v14
- Captcha-canvas
- ChatGPT
- SQLite3 or MySQL 8.0
- Sequelize

## Pre-requisites

Before running the bot, you will need the following:

- **Node.js**: You will need Node.js installed on your machine to run the bot. You can download and install Node.js from the official website at https://nodejs.org.
- **Discord Bot Token**: You will need a Discord bot token to authenticate your bot with the Discord API. You can obtain a token by creating a new bot application on the Discord Developer Portal at https://discord.com/developers/applications.
- **Alchemy API Key**: You will need an Alchemy API key to access the Alchemy Web3 API. You can obtain a key by creating an account on the Alchemy website at https://alchemyapi.io.
- **OpenAI API Key**: You will need an OpenAI API key to use the OpenAI package. You can obtain a key by creating an account on the OpenAI website at https://openai.com.
- **Twitter API Keys and Tokens**: You will need Twitter API keys and tokens to authenticate and integrate the bot with Twitter. You can obtain these by creating a new project and developer account on the Twitter Developer Portal at https://developer.twitter.com.
- **Database**: You will need a database to store data related to the bot. In this project, SQLite3 is used then later migrated to MySQL 8.0. You can download and install SQLite3 from the official website at https://www.sqlite.org/download.html. Alternatively, you can use other databases supported by Sequelize, such as PostgreSQL, MySQL, or MariaDB.

## List of Discord bot features (work in progress)

- [x] Verification with Captcha
- [x] NFT Verification
- [ ] Create and manage Giveaways
- [ ] Create and manage Raffles
- [x] Post announcements for orders, etc.
- [x] Mini games (arena, etc.)
- [x] Auto purge messages
- [ ] View Action/Moderation Log
- [ ] Create and manage Reaction roles
- [ ] Create and manage Forms
- [ ] Send Auto Messages/webhooks
- [x] Post tweets
- [x] Raid tracking for Discord users
- [x] Storytelling
- [x] Creating and closing private channels
- [ ] Scheduling events
- [ ] Ticketing system
- [ ] Whitelisting
- [ ] Sales tracking
- [x] Audit logs
- [ ] Exploration mode
- [ ] World bosses

All of these may not require having administrator role on the bot for security, but they are subject to change without prior notice.

## Installation

To install and run the project, follow these steps:

1. Clone this repository to your local machine using `git clone https://github.com/xkyanari/megura-js.git`
2. Navigate to the project directory in your terminal
3. Install dependencies using `npm install`
4. Rename `config-example.json` to `config.json` `assets/feature-example.json` to `src/feature.js` and update the values
5. (Optional) Database name can be changed including the settings in `src/db.js`.
6. (Optional) Chapters can be uploaded in `chapters/`. Otherwise, the bot will simply load the placeholder stories found in `samples/`.

## Commands (work in progress)

- `/attack`: Initiate attack against a random monster.
- `/buy`: Lets player to buy items in bulk.
- `/changenick`: Updates player name.
- `/close`: Closes a portal pre-maturely.
- `/daily`: Do a random quest to increase/decrease stats or gain Iura.
- `/duel`: Initiate a duel against another player.
- `/info`: Shows the list of commands.
- `/inventory`: Opens your inventory.
- `/iura`: Check your wallet or bank.
- `/join`: Adds your NFT to your player profile.
- `/open <name of channel>`: Creates a private channel, auto-closes in 10 minutes.
- `/profile`: Show profile of a user (blank for self).
- `/raid`: Post tweets for people to retweet and/or like.
- `/ranks`: Show leaderboards.
- `/reset`: Delete voyager profile.
- `/setup`: Setup server for moderation tools.
- `/shop`: Opens the Item Shop.
- `/start`: Initiate creating own character.
- `/transfer`: Transfer IURA to another user.

- `!tweet`: Post a tweet from your server Twitter account (configured from /setup).
- `!purge`: Remove x amount of old messages in a channel.

## Contributing

If you'd like to contribute to the project, please follow these steps:

1. Fork the project
2. Create a new branch (`git checkout -b feature`)
3. Make your changes and commit them (`git commit -am 'Add feature'`)
4. Push to the branch (`git push origin feature`)
5. Create a new Pull Request

## License

This project is licensed under the [GPL-3.0 license](https://opensource.org/license/gpl-3-0/).
