# Messinia Graciene: Project DAHLIA

Dahlia is a highly sophisticated bot that runs in chatGPT with slash and text commands. She's an all-rounder Discord bot with many utilities but the main one is to serve as a storyteller of a text-based RPG. Players with supported NFT collections can communicate with Dahlia for the game.

## Packages:
- Node.js
- Alchemy SDK
- Solscan API
- Discord.js v14
- Captcha-canvas
- ChatGPT
- SQLite3
- Sequelize

## Pre-requisites
Before running the bot, you will need the following:

- **Node.js**: You will need Node.js installed on your machine to run the bot. You can download and install Node.js from the official website at https://nodejs.org.
- **Discord Bot Token**: You will need a Discord bot token to authenticate your bot with the Discord API. You can obtain a token by creating a new bot application on the Discord Developer Portal at https://discord.com/developers/applications.
- **Alchemy API Key**: You will need an Alchemy API key to access the Alchemy Web3 API. You can obtain a key by creating an account on the Alchemy website at https://alchemyapi.io.
- **OpenAI API Key**: You will need an OpenAI API key to use the OpenAI package. You can obtain a key by creating an account on the OpenAI website at https://openai.com.

## List of Discord bot features (features pending):
- Verification with Captcha
- Giveaways
- Raffles
- Announcements
- Mini games
- Auto purge messages
- Action log
- Custom commands
- Reaction roles
- Forms
- Auto Message
- Storytelling
- Creating and closing private channels
- Creating, modifying, deleting sub-guilds (channels)
- Scheduling events
- Ticketing system
- Whitelisting
- Sales tracking

All of these may not require having administrator role on the bot for security, but they are subject to change without prior notice.

## Table of Contents

- [Installation](#installation)
- [Commands](#commands)
- [Contributing](#contributing)
- [License](#license)

## Installation

To install and run the project, follow these steps:

1. Clone this repository to your local machine using `git clone https://github.com/xkyanari/megura-js.git`
2. Navigate to the project directory in your terminal
3. Install dependencies using `npm install`
4. Rename config-example.json to config.json and update the values
5. (Optional) Database name can be changed including the settings in src/db.js.
6. (Optional) Chapters can be uploaded in chapters/. Otherwise, the bot will simply load the placeholder stories found in samples/.

## Commands
- `/info`:  Shows the list of commands.
- `/start`:  Initiate creating own character.
- `/profile`:  Show profile of a user (blank for self).
- `/changenick`:  Updates player name.
- `/join`:  Adds your NFT to your player profile.
- `/daily`:  Do a random quest to increase/decrease stats or gain Iura.
- `/attack`:  Initiate attack against a random monster.
- `/duel`:  Initiate a duel against another player.
- `/open <name of channel>`:  Creates a private channel, auto-closes in 10 minutes.
- `/close`:  Closes a portal pre-maturely.
- `/iura`:  Check your wallet or bank.
- `/shop`:  Opens the Item Shop.
- `/inventory`:  Opens your inventory.
- `/buy`:  Lets player to buy items in bulk.

## Contributing

If you'd like to contribute to the project, please follow these steps:

1. Fork the project
2. Create a new branch (`git checkout -b feature`)
3. Make your changes and commit them (`git commit -am 'Add feature'`)
4. Push to the branch (`git push origin feature`)
5. Create a new Pull Request

## License

This project is licensed under the [GPL-3.0 license](https://opensource.org/license/gpl-3-0/).
