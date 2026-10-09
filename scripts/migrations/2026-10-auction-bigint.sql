-- Store auction and bid amounts (satoshis) as BIGINT instead of FLOAT.
-- FLOAT is single precision in MySQL and rounds amounts above about 0.17 coin.
--
-- Run once, with the bot stopped, after backing up the database:
--   mysqldump -u <user> -p <database> Auction Bid > auction-backup.sql
--   mysql -u <user> -p <database> < scripts/migrations/2026-10-auction-bigint.sql
--
-- ROUND keeps the closest whole satoshi for values FLOAT already rounded.

UPDATE `Auction` SET
	`startPrice` = ROUND(`startPrice`),
	`currentPrice` = ROUND(`currentPrice`),
	`increment` = ROUND(`increment`);
UPDATE `Bid` SET `bidAmount` = ROUND(`bidAmount`);

ALTER TABLE `Auction`
	MODIFY `startPrice` BIGINT NULL,
	MODIFY `currentPrice` BIGINT NULL,
	MODIFY `increment` BIGINT NULL;
ALTER TABLE `Bid`
	MODIFY `bidAmount` BIGINT NULL;
