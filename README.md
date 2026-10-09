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
- [Running with Docker](#running-with-docker)
- [Running tests](#running-tests)
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
- [x] Create and manage Giveaways
- [x] Create and manage Raffles
- [x] Post announcements for orders, etc.
- [x] Mini games (arena, etc.)
- [x] View server setup logs
- [x] Create and manage Reaction roles (button roles)
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

## Running with Docker

`docker-compose.yml` runs the bot in a container and replaces pm2. MySQL and Redis keep running on the host. The container shares the host's network (`network_mode: host`), so the `127.0.0.1` addresses in `config.json` keep working and nothing about MySQL or Redis needs to change. The bot opens no ports.

**What the container needs on the host:**
- `config.json` and `assets/features.json` next to `docker-compose.yml`. They are mounted read-only and never copied into the image.
- Optionally, a `.env` file with `DISCORD_TOKEN=...`. It takes precedence over `token` in `config.json`.

The log files from `logs/` live in the `megura-logs` Docker volume, and console output goes to `docker compose logs`.

**Installing Docker:** use Docker's own packages (Docker Engine with the Compose v2 plugin). Debian 12's `docker.io` and `docker-compose` packages are too old for this `docker-compose.yml`. On Debian:

```sh
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
docker compose version   # needs v2.24 or later
```

**Switching from pm2:**

1. **Update the code.** If `git pull` stops because of local changes, run `git stash` and pull again; `git stash show -p` shows what was set aside.
   ```sh
   git pull
   ```
2. **Check the server.** This changes nothing. It prints every problem with the command that fixes it, and exits non-zero until everything is ready.
   ```sh
   bash scripts/docker-preflight.sh
   ```
   It covers:
   - Docker and Compose versions;
   - `config.json` and `assets/features.json` (present, valid, readable by the container's uid 1000);
   - the Discord token;
   - MySQL and Redis reachable;
   - `isTestnet`;
   - swap and disk space;
   - whether pm2 is still running the bot.
3. **Build while the old bot keeps running:**
   ```sh
   docker compose build
   ```
4. **Switch over at a quiet moment,** when no brawl challenge is open: challenges opened by the old version don't hold their stakes.
   ```sh
   pm2 stop <app>           # your pm2 app name, see `pm2 list`
   docker compose up -d
   docker compose logs -f   # wait for "You're now connected as ..."
   ```
5. **Re-register the slash commands.** Their options changed, for example amounts must now be at least 1.
   ```sh
   docker compose run --rm bot node deploy.js
   ```
6. **Make it permanent:**
   ```sh
   pm2 delete <app>
   pm2 save
   ```
   Docker restarts the container after crashes and reboots (`restart: unless-stopped`), as long as the Docker service is enabled (`sudo systemctl enable docker`).

**Rolling back:** `docker compose down`, then `pm2 start <app>`. pm2 still has the app until step 6.

**After an update:** new features come with a flag in `assets/features-example.json`. Flags missing from your `assets/features.json` count as off, so that feature stays disabled on every tier. The pre-flight script lists any missing flags; copy them over and set each to `true` or `false`.

**Everyday commands:**

| Task | Command |
|---|---|
| Update after `git pull` | `bash scripts/docker-preflight.sh`, then `docker compose up -d --build`, then `docker compose run --rm bot node deploy.js` if commands changed |
| Follow output | `docker compose logs -f` |
| Register slash commands | `docker compose run --rm bot node deploy.js` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |
| Read the log files | `docker compose exec bot ls logs` |
| Free disk after updates | `docker image prune -f` |

**Small servers (around 2 GB of RAM):** the bot itself uses about 200–350 MB, and `docker-compose.yml` caps it at 768 MB. Peaks are what run a small box out of memory, for example a `docker compose build` while MySQL and other tools are running. A few settings help:

- **Add swap** so a peak doesn't trigger the out-of-memory killer:
  ```sh
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf && sudo sysctl --system
  ```
- **Check which database you run** with `mysqld --version`. On Debian 12, `mysql-server` installs MariaDB 10.11, which is already light and needs no tuning. On MySQL 8, add `performance_schema = OFF` and `innodb_buffer_pool_size = 128M` under `[mysqld]`, then restart MySQL.
- **Clean up old images** after updates with `docker image prune -f`.

## Running tests

The integration tests cover the IURA, shop, order and brawl money paths and the interaction handler. They run against a real MySQL database and Redis, and they **drop and recreate every table**, so use a separate database. The name must contain `test`, or the suite refuses to run.

```sh
mysql -e "CREATE DATABASE megura_test; GRANT ALL ON megura_test.* TO 'megura'@'127.0.0.1' IDENTIFIED BY 'megura';"
npm run test:integration
```

The tests never read `config.json`; they use `test/config.js`. Override the defaults with `TEST_MYSQL_DB`, `TEST_MYSQL_USER`, `TEST_MYSQL_PASS`, `TEST_MYSQL_HOST`, `TEST_MYSQL_PORT` and `TEST_REDIS_URL` (default `redis://127.0.0.1:6379/15`; the suite flushes this Redis database).

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
