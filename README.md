# Messinia Graciene: Project DAHLIA

![Project DAHLIA banner](https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png)

5. Copy `assets/features-example.json` to `assets/features.json` and adjust which features each plan gets.

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
- **MySQL 8.0 database**: Dahlia stores guild settings, player profiles, inventory, IURA balances, brawls, and other gameplay state in MySQL through Sequelize.
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
- [x] Create and manage Forms
- [x] Send Auto Messages/webhooks
- [x] Storytelling
- [x] Creating and closing private channels
- [x] Scheduling events
- [x] Ticketing system
- [x] Sales tracking for the special shop (`/sales`)
- [x] Slash-command RPG profile and inventory system
- [x] Brawls
- [ ] Auctions (switched off. To bring them back, set `"enableAuctions": true` in `config.json` **and** `"hasAuction": true` for the tiers that should have them in `assets/features.json`, then run `node deploy.js`)
- [x] Exploration mode (`/explore`)
- [x] Gear upgrades, crafting and salvage (`/upgrade`, `/craft`, `/salvage`)
- [x] Bosses: solo and world bosses (behind the `hasBosses` feature flag)

All of these may not require having administrator role on the bot for security, but they are subject to change without prior notice.

## Installation

To install and run the project, follow these steps:

1. Clone this repository to your local machine using `git clone https://github.com/xkyanari/megura-js.git`
2. Navigate to the project directory in your terminal
3. Install dependencies using `npm install`
4. Rename `config-example.json` to `config.json` and update the values for Discord, MySQL, Redis, Cloudinary, and other services you enable.
5. Copy `assets/features-example.json` to `assets/features.json` and adjust which features each plan gets.
6. Database settings (`mysql_host`, `mysql_dbname`, `mysql_dbuser`, `mysql_dbpass`, `mysql_port`) are read from `config.json`; `src/db.js` itself needs no changes.
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
   - `testMode` (the older `isTestnet` key still works);
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
| Update to the latest `main` | `bash scripts/update.sh` (see **Updating** below) |
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

**Updating.** One command does a whole update:

```sh
bash scripts/update.sh            # does nothing if main has no new commits
bash scripts/update.sh --force    # runs every step anyway
```

It runs these steps in order:
1. Pulls `main`.
2. Runs the pre-flight check.
3. Builds the new image while the old bot keeps running.
4. Backs up the database to `backups/` (the last 10 are kept).
5. Stops the bot.
6. Runs any new database migrations.
7. Registers the slash commands.
8. Starts the bot and waits until it's healthy, meaning it's logged in to Discord (up to 3 minutes).

If the pre-flight check, build or backup fails, the bot isn't touched. If a migration fails or the new bot doesn't become healthy, the previous code and image are started again, and the backup's path is printed so the database can be restored if needed. Everything is logged to `logs/update.log`. Run it as a user who can run `docker`. If the checkout belongs to a user who can't, run it with `sudo DEPLOY_OWNER=<owner> bash scripts/update.sh`. Git and the files it writes then stay owned by that user. It needs `mysqldump` (or `mariadb-dump`) on the host, from the `mysql-client` or `mariadb-client` package.

**Automatic updates.** A watcher on the server deploys each new GitHub **release**. Nothing on GitHub needs access to the server. Every 5 minutes, a systemd timer checks the repository's latest release (drafts and prereleases don't count). When there's a new one, the watcher:

1. Checks that the release's tag points at a commit on `main`, and that the **Tests** workflow passed on that commit. If the tests are still running, it waits for them. If they failed, it skips the release.
2. Runs `scripts/update.sh` for that exact commit. That script backs up the database, runs the migrations, waits for the bot to be healthy, and rolls back if it isn't.
3. Posts the result to a Discord channel: deployed, skipped, failed (with the update's last log lines), or already included when the server already runs that commit or a newer one.

A release that failed or was skipped isn't tried again until a newer release is published, or someone runs `sudo megura-watch --retry`.

To ship a version, publish a release on GitHub (**Releases → Draft a new release**, with a new tag such as `v1.4.0`, targeting `main`), or run:

```sh
gh release create v1.4.0 --target main --generate-notes
```

Setting it up takes one time. As a user with sudo, run:

```sh
sudo bash /home/<owner>/megura-js/scripts/install-release-watcher.sh
```

It asks for a Discord webhook URL (channel settings → **Integrations → Webhooks**) and sends a test message. It installs the watcher as `/usr/local/sbin/megura-watch`, stores its settings in `/etc/megura/watch.env` and starts the `megura-watch.timer`. If a release changes `scripts/release-watch.sh`, the Discord message says so; run the installer again to pick up the change.

| To | Run |
|---|---|
| See the last result and the latest release | `sudo megura-watch --status` |
| Follow what it's doing | `journalctl -u megura-watch -f` |
| Try a failed or skipped release again | `sudo megura-watch --retry` |
| Check for a release now | `sudo systemctl start megura-watch` |
| Pause automatic deploys | `sudo systemctl stop megura-watch.timer` (`start` to resume) |

The watcher runs as root because it has to run `docker`. Git commands, logs and backups run as the checkout's owner, so the owner keeps owning every file in the checkout. Root runs `update.sh` and the pre-flight check as they are in the release's commit, never the copies in the working tree. Docker, though, builds and starts from the working tree's `Dockerfile`, `docker-compose.yml` and `.env`, and whoever controls those controls root (for example with `privileged: true` or by mounting `/`). So:

- **The checkout's owner must be someone you'd trust as root.** In practice they're usually in the `docker` group anyway, which amounts to the same thing.
- **Anyone who can publish a release can run code as root on the server**, for example by changing `docker-compose.yml`. That holds for any automatic Docker deploy. Use two-factor authentication on GitHub and limit who can publish releases.

**Database migrations.** The bot creates new tables by itself but never changes existing ones, so some updates ship a script in `scripts/migrations/`. `scripts/update.sh` runs the new ones for you through `scripts/migrate.js`, which records each one in the `_migrations` table so it runs only once. Every migration is safe to run again, so on a server where some were run by hand, the first run just records them. To run them yourself, stop the bot and back up first:

```sh
docker compose down
docker compose run --rm bot node scripts/migrate.js --dry-run   # lists what would run
docker compose run --rm bot node scripts/migrate.js
docker compose up -d
```

| Script | Why |
|---|---|
| `2026-10-auction-bigint.sql` | Auction and bid amounts are stored as whole numbers (`BIGINT`) instead of `FLOAT`, which rounded large amounts. |
| `2026-10-gameplay.js` | Adds the daily-streak columns and new shop items, and unequips stacked or over-limit gear. |
| `2026-10-health-curve.js` | Moves players onto the new health curve, keeping health from gear. |
| `2026-10-remove-crypto.js` | Drops the unused NFT link columns from `Player`, and moves special-shop items from the removed Whitelist, NFTs and Cryptocurrencies categories to Digital Items. |
| `2026-10-order-sales.js` | Adds the price paid and the order date to special-shop orders, for `/sales`. **Run it before starting this version**: the bot reads those columns. |
| `2026-10-crafting.js` | Adds the upgrade level to inventory items, and the materials and crafted items to the shop. **Run it before starting this version**: every inventory lookup reads that column. |

**Vote rewards (top.gg and discordbotlist).** `/vote` pays 50 IURA per vote through a small webhook server inside the bot. It only starts when `VOTE_PORT` is set:

1. Add `VOTE_PORT=8080` to `.env` (any free port), and put the shared secrets in `config.json` as `topWebhookSecret` and `dblWebhookSecret`.
2. Restart with `docker compose up -d`. The log shows `Vote webhook server listening on port 8080`.
3. Make the port reachable. The container uses the host's network, so it's open on the server itself: allow it in the firewall, or better, put it behind a reverse proxy with HTTPS (then also set `TRUST_PROXY=1` in `.env`).
4. In each site's webhook settings, use `https://<your-domain>/top/upvote` (top.gg) or `https://<your-domain>/dbl/upvote` (discordbotlist), with the same secret as the Authorization value.

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

- `/attack`: Fight a random monster sized to your level. Wins pay IURA and EXP, sometimes drop an item or a crafting material, and consumables in your inventory are used automatically when your health runs low.
- `/auction`: Start, view, or manage auctions (switched off by default; see `enableAuctions`).
- `/boss`: Fight a boss turn by turn, on your own (`challenge`) or as a channel (`spawn`, `autospawn` for moderators). Needs the `hasBosses` feature.
- `/brawl`: Start or join a brawl challenge.
- `/buy`: Lets player to buy items in bulk.
- `/changenick`: Updates player name.
- `/checkprofile`: Check whether your player profile exists.
- `/close`: Closes a portal prematurely.
- `/craft`: `recipes` lists what can be crafted and what you have for it; `make` crafts an item from materials.
- `/daily`: Do a random quest to gain IURA. Claiming within 48 hours keeps a streak going, worth up to +60%.
- `/duel`: Initiate a duel against another player.
- `/equip`: Equip an inventory item: one copy each, in 1 weapon, 3 armor and 1 accessory slot.
- `/explore`: `map` shows the places of Eldelvain, `travel` moves you to one you have unlocked (monsters for `/attack` then come from there), and `search` looks around every 30 minutes.
- `/factions`: `join` picks your faction; `standings` shows this week's faction points and last season's result; `setup` (moderators) sets where weekly season results are posted and an optional champion role.
- `/info`: Shows the list of commands.
- `/inventory`: Opens your inventory.
- `/invite`: Shows the bot invite link.
- `/iura`: Check your wallet or bank.
- `/open <name of channel>`: Creates a private channel, auto-closes in 10 minutes.
- `/privacy`: Shows the privacy notice.
- `/profile`: Show profile of a user (blank for self): stats, faction, where they're exploring, and this week's quests, discoveries and faction points.
- `/quests`: See your daily and weekly quest objectives and their rewards.
- `/rankings`: Server leaderboards: duel wins, level, monster kills, top earners, quests finished this week, places discovered, and faction points this week.
- `/requestduel`: Respond to a duel request.
- `/reset`: Delete voyager profile.
- `/sales`: (Moderators) Special shop sales for the last 7 or 30 days or all time, with an optional CSV export.
- `/salvage`: Break unequipped gear into crafting materials.
- `/sell`: Sell inventory items back to the shop for 40% of their price.
- `/sendgift`: Send a gift to another player.
- `/setup`: Setup server for moderation tools.
- `/shop`: Opens the Item Shop.
- `/specialshop`: Opens the Special Shop.
- `/start`: Initiate creating own character.
- `/story`: (Moderators) Play a chapter of the storyline in a channel, stop it, or list the chapters this server has played.
- `/support`: Shows support server information.
- `/transfer`: Transfer IURA to another user.
- `/unequip`: Unequip an item.
- `/upgrade`: Upgrade a weapon, armor or accessory up to +5 (+10% of its stats per level). From +3 up a failed upgrade drops a level, unless you use a Ward Stone.
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
