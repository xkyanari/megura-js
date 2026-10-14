const { sequelize, Brawl, Player, moveIura, escrowOres, releaseOres } = require('../src/db');
const { isTestMode } = require('../src/vars');

/**
 * Brawl wagers are escrowed in IURA: each player's stake leaves their wallet when
 * they commit, and the pot (2 x wager) is paid out exactly once. Every step locks
 * the brawl row and checks its state, so double clicks, late timers and retries
 * are no-ops. In test mode nothing moves.
 *
 * Brawls opened before wagers switched to IURA have currency 'ores': their stakes
 * sit in the guild wallet and are refunded or paid out in ores.
 */

const escrow = !isTestMode;

const findAccount = (discordID, guildID, transaction) =>
	Player.findOne({ where: { discordID, guildID }, attributes: ['accountID'], transaction });

// Takes a stake. Throws 'insufficient funds' without changing anything if the player can't cover it.
const takeStake = async (currency, discordID, guildID, amount, transaction) => {
	if (currency === 'ores') return escrowOres(discordID, guildID, amount, transaction);
	const player = await findAccount(discordID, guildID, transaction);
	if (!player) throw new Error('insufficient funds');
	await moveIura(player.accountID, 'wallet', null, amount, transaction);
};

// Pays `amount` to a player. Returns false if they no longer have a profile.
const payOut = async (currency, discordID, guildID, amount, transaction) => {
	if (currency === 'ores') return releaseOres(discordID, guildID, amount, transaction);
	const player = await findAccount(discordID, guildID, transaction);
	if (!player) return false;
	try {
		await moveIura(player.accountID, null, 'wallet', amount, transaction);
	}
	catch (error) {
		if (error.message === 'account not found') return false;
		throw error;
	}
	return true;
};

// Escrows the challenger's stake and creates the listing.
// Throws 'duplicate listing' if the id was ever used before, since every lookup is by listingId alone.
const openBrawl = async ({ listingId, challengerId, guildID, wager }) => {
	return sequelize.transaction(async (transaction) => {
		if (await Brawl.count({ where: { listingId }, transaction })) {
			throw new Error('duplicate listing');
		}
		if (escrow) await takeStake('iura', challengerId, guildID, wager, transaction);
		await Brawl.create({ listingId, challengerId, wager, currency: 'iura', status: 'pending' }, { transaction });
	});
};

const lockBrawl = (listingId, transaction) =>
	Brawl.findOne({ where: { listingId }, transaction, lock: transaction.LOCK.UPDATE });

// Claims an open listing for the acceptor and escrows their stake.
// Returns { ok: true, brawl } or { ok: false, reason }.
const acceptBrawl = async (listingId, acceptorId, guildID) => {
	return sequelize.transaction(async (transaction) => {
		const brawl = await lockBrawl(listingId, transaction);

		if (!brawl || brawl.status !== 'pending') return { ok: false, reason: 'not open' };
		if (brawl.acceptorId) return { ok: false, reason: 'taken' };
		if (brawl.challengerId === acceptorId) return { ok: false, reason: 'self' };

		if (escrow) {
			try {
				await takeStake(brawl.currency, acceptorId, guildID, brawl.wager, transaction);
			}
			catch (error) {
				if (error.message === 'insufficient funds') return { ok: false, reason: 'insufficient funds' };
				throw error;
			}
		}

		brawl.acceptorId = acceptorId;
		await brawl.save({ transaction });
		return { ok: true, brawl };
	});
};

// Closes a listing nobody accepted and refunds the challenger.
const expireBrawl = async (listingId, guildID) => {
	return sequelize.transaction(async (transaction) => {
		const brawl = await lockBrawl(listingId, transaction);
		if (!brawl || brawl.status !== 'pending' || brawl.acceptorId) return false;

		brawl.status = 'expired';
		await brawl.save({ transaction });
		if (escrow) await payOut(brawl.currency, brawl.challengerId, guildID, brawl.wager, transaction);
		return true;
	});
};

// Pays out an accepted brawl: the winner takes the pot, a draw (winnerId null) refunds both.
const settleBrawl = async (listingId, guildID, winnerId) => {
	return sequelize.transaction(async (transaction) => {
		const brawl = await lockBrawl(listingId, transaction);
		if (!brawl || brawl.status !== 'pending' || !brawl.acceptorId) return false;

		const { challengerId, acceptorId, wager, currency } = brawl;

		brawl.status = 'completed';
		brawl.outcome = winnerId === challengerId ? 'challenger_win'
			: winnerId === acceptorId ? 'acceptor_win'
				: 'draw';
		await brawl.save({ transaction });

		if (escrow) {
			if (brawl.outcome === 'draw') {
				await payOut(currency, challengerId, guildID, wager, transaction);
				await payOut(currency, acceptorId, guildID, wager, transaction);
			}
			else {
				await payOut(currency, winnerId, guildID, wager * 2, transaction);
			}
		}
		return true;
	});
};

// How long a listing stays open, and how long before an unfinished brawl is refunded as a draw.
const BRAWL_EXPIRY = 10 * 60 * 1000;
const BRAWL_SETTLE_TIMEOUT = 30 * 60 * 1000;

// Runs a job queued with client.brawlQueue (see events/ClientReady.js).
const processBrawlJob = async ({ type, listingId, guildID }) => {
	if (type === 'expire') return expireBrawl(listingId, guildID);
	if (type === 'settle') return settleBrawl(listingId, guildID, null);
	throw new Error(`Unknown brawl job: ${type}`);
};

module.exports = {
	openBrawl,
	acceptBrawl,
	expireBrawl,
	settleBrawl,
	processBrawlJob,
	BRAWL_EXPIRY,
	BRAWL_SETTLE_TIMEOUT,
};
