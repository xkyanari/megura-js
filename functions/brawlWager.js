const { sequelize, Brawl, escrowOres, releaseOres } = require('../src/db');
const { isTestMode } = require('../src/vars');

/**
 * Brawl wagers are escrowed: each player's stake moves from their ores into the
 * guild wallet when they commit, and the pot (2 x wager) is paid out exactly once.
 * Every step locks the brawl row and checks its state, so double clicks, late
 * timers and retries are no-ops. In test mode no ores move.
 */

const escrow = !isTestMode;

// Escrows the challenger's stake and creates the listing.
// Throws 'duplicate listing' if the id was ever used before, since every lookup is by listingId alone.
const openBrawl = async ({ listingId, challengerId, guildID, wager }) => {
	return sequelize.transaction(async (transaction) => {
		if (await Brawl.count({ where: { listingId }, transaction })) {
			throw new Error('duplicate listing');
		}
		if (escrow) await escrowOres(challengerId, guildID, wager, transaction);
		await Brawl.create({ listingId, challengerId, wager, status: 'pending' }, { transaction });
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
				await escrowOres(acceptorId, guildID, brawl.wager, transaction);
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
		if (escrow) await releaseOres(brawl.challengerId, guildID, brawl.wager, transaction);
		return true;
	});
};

// Pays out an accepted brawl: the winner takes the pot, a draw (winnerId null) refunds both.
const settleBrawl = async (listingId, guildID, winnerId) => {
	return sequelize.transaction(async (transaction) => {
		const brawl = await lockBrawl(listingId, transaction);
		if (!brawl || brawl.status !== 'pending' || !brawl.acceptorId) return false;

		const { challengerId, acceptorId, wager } = brawl;

		brawl.status = 'completed';
		brawl.outcome = winnerId === challengerId ? 'challenger_win'
			: winnerId === acceptorId ? 'acceptor_win'
				: 'draw';
		await brawl.save({ transaction });

		if (escrow) {
			if (brawl.outcome === 'draw') {
				await releaseOres(challengerId, guildID, wager, transaction);
				await releaseOres(acceptorId, guildID, wager, transaction);
			}
			else {
				await releaseOres(winnerId, guildID, wager * 2, transaction);
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
