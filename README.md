# Dahlia — Free edition

The public, self-hostable Free edition of the Megura Discord RPG bot. The full managed bot and Premium implementation are developed separately in a private repository. This repository contains no payment or marketplace implementation.

## Included

- Voyager profiles, confirmed character deletion, exploration, battles and duels
- IURA wallets/banks, the global equipment shop, inventory, crafting and salvage
- IURA brawls, quests and rankings
- CAPTCHA verification, button roles, tickets and forms

Giveaways, raffles, custom server shops, scheduled posts, private voyager channels, faction role management, world bosses, authored story playback and Premium directory/billing/marketplace code are not included. Changing a plan flag does not install those features.

## Public documentation and GitBook

`docs/` remains the public documentation for the official Dahlia service, including guides for released managed features that are not included in this Free source edition. `.gitbook.yaml` keeps the GitBook content root at `docs/`; its navigation is `docs/SUMMARY.md`. Internal planning and unreleased story material must never be copied here.

## Local setup

Use Node 22 or 24, MySQL 8 and Redis 7. Run `npm ci`, copy `config-example.json` to `config.json`, and copy `assets/features-example.json` to `assets/features.json`. Fill in your own bot, database and Redis settings. Keep credentials out of Git. Register your bot's commands with `node deploy.js`, then start with `node index.js`.

Use a separate application and database for this self-hosted edition. It is not a drop-in downgrade of a managed Premium bot with outstanding jobs or rewards.

For Docker, configure the mounted runtime files in `docker-compose.yml`, then run `docker compose up -d --build`. Command registration remains a separate step: `docker compose run --rm bot node deploy.js`.

## Validation

Run `npm run lint` and `npm run test:integration`. Integration tests drop and recreate tables; configure `TEST_MYSQL_DB` with a disposable database name containing `test`, plus `TEST_MYSQL_HOST`, `TEST_MYSQL_PORT`, `TEST_MYSQL_USER`, `TEST_MYSQL_PASS` and `TEST_REDIS_URL`.

## Contributions and history

This Free edition starts with a new public history after the repository split. Prior commit history and attribution are preserved in the private full-bot repository. The existing GPL-3.0 license is retained. Previously public code remains subject to its original license; this split does not retract copies already distributed.

Submit Free-edition fixes here. Do not submit internal roadmaps, unpublished chapters, Premium implementation, credentials or production data. Public GitBook guide corrections may be made here for either service tier.

This repository does not publish a new bot release as part of the split. Production deployment remains paused.
