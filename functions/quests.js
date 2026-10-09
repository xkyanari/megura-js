const { createHash } = require('node:crypto');
const { sequelize, Player, Guild, QuestProgress, moveIura } = require('../src/db');
const { dayKey, weekKey } = require('./period');
const { playerFaction } = require('./factions');

/**
 * Daily and weekly quest objectives. Every player gets DAILY_COUNT objectives
 * a day and WEEKLY_COUNT a week (UTC), picked from the pools below in an order
 * fixed by their account and the period, so they don't change on a whim.
 * Progress comes from what they do (recordProgress), and an objective pays
 * its reward, scaled by level, the moment it is completed.
 */

const OBJECTIVES = {
	monsterWins: { event: 'monsterWin', text: (n) => `Win ${n} monster fight${n === 1 ? '' : 's'}` },
	rivalKills: { event: 'rivalKill', text: (n) => `Defeat ${n} monster${n === 1 ? '' : 's'} of the rival faction`, needsFaction: true },
	lootFound: { event: 'loot', text: (n) => `Find ${n} item${n === 1 ? '' : 's'} on monsters` },
	duelWins: { event: 'duelWin', text: (n) => `Win ${n} duel${n === 1 ? '' : 's'} you started` },
};

// reward IURA and EXP are per player level
const DAILY_POOL = [
	{ objective: 'monsterWins', target: 3, iura: 30, exp: 100 },
	{ objective: 'rivalKills', target: 2, iura: 40, exp: 120 },
	{ objective: 'lootFound', target: 1, iura: 25, exp: 80 },
	{ objective: 'duelWins', target: 1, iura: 40, exp: 100 },
];
const WEEKLY_POOL = [
	{ objective: 'monsterWins', target: 25, iura: 300, exp: 1000 },
	{ objective: 'rivalKills', target: 15, iura: 350, exp: 1100 },
	{ objective: 'duelWins', target: 5, iura: 300, exp: 900 },
];
const DAILY_COUNT = 3;
const WEEKLY_COUNT = 1;

const rank = (seed, key) => createHash('sha256').update(`${seed}:${key}`).digest().readUInt32BE(0);

const pickFor = (pool, count, accountID, periodKey, hasFaction) => pool
	.filter((quest) => hasFaction || !OBJECTIVES[quest.objective].needsFaction)
	.sort((a, b) => rank(`${accountID}:${periodKey}`, a.objective) - rank(`${accountID}:${periodKey}`, b.objective))
	.slice(0, count);

// The player's objectives right now: [{ period, periodKey, objective, target, iura, exp, text }].
const questsFor = (accountID, { hasFaction = false, now = Date.now() } = {}) => {
	const periods = [
		{ period: 'daily', periodKey: dayKey(now), pool: DAILY_POOL, count: DAILY_COUNT },
		{ period: 'weekly', periodKey: weekKey(now), pool: WEEKLY_POOL, count: WEEKLY_COUNT },
	];
	return periods.flatMap(({ period, periodKey, pool, count }) =>
		pickFor(pool, count, accountID, periodKey, hasFaction).map((quest) => ({
			...quest,
			period,
			periodKey,
			text: OBJECTIVES[quest.objective].text(quest.target),
		})));
};

// Whether the player has a faction (faction objectives are only for them).
const hasFactionFor = async (player, transaction) =>
	Boolean(playerFaction(player, await Guild.findOne({ where: { guildID: player.guildID }, transaction })));

const rewardFor = (quest, level) => ({ iura: quest.iura * Math.max(level, 1), exp: quest.exp * Math.max(level, 1) });

/**
 * Counts `amount` of `event` ('monsterWin', 'rivalKill', 'loot' or 'duelWin') toward the player's objectives, and pays any it completes.
 * Returns the completed quests with their rewards: [{ text, iura, exp }].
 */
const recordProgress = (accountID, event, { amount = 1, now = Date.now() } = {}) => {
	if (amount < 1) return Promise.resolve([]);

	return sequelize.transaction(async (transaction) => {
		const player = await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
		if (!player) return [];
		const hasFaction = await hasFactionFor(player, transaction);
		const quests = questsFor(accountID, { hasFaction, now }).filter((quest) => OBJECTIVES[quest.objective].event === event);

		const completed = [];
		for (const quest of quests) {
			const where = { accountID, periodKey: quest.periodKey, objective: quest.objective };
			const [row] = await QuestProgress.findOrCreate({ where, defaults: { ...where, progress: 0 }, transaction });
			if (row.completed) continue;

			const progress = Math.min(row.progress + amount, quest.target);
			const done = progress >= quest.target;
			await row.update({ progress, completed: done }, { transaction });
			if (!done) continue;

			const reward = rewardFor(quest, player.level);
			await moveIura(accountID, null, 'wallet', reward.iura, transaction);
			await player.increment({ iuraEarned: reward.iura, expGained: reward.exp }, { transaction });
			completed.push({ text: quest.text, period: quest.period, ...reward });
		}
		return completed;
	});
};

// The player's objectives with their progress, for /quests.
const questBoard = async (player, { now = Date.now() } = {}) => {
	const quests = questsFor(player.accountID, { hasFaction: await hasFactionFor(player), now });
	const rows = await QuestProgress.findAll({
		where: { accountID: player.accountID, periodKey: [...new Set(quests.map((quest) => quest.periodKey))] },
	});
	return quests.map((quest) => {
		const row = rows.find((r) => r.periodKey === quest.periodKey && r.objective === quest.objective);
		return { ...quest, ...rewardFor(quest, player.level), progress: row?.progress ?? 0, completed: row?.completed ?? false };
	});
};

// One line per completed quest, for result messages.
const completedLines = (completed) =>
	completed.map((quest) => `📜 Quest complete: **${quest.text}** (+${quest.iura} IURA, +${quest.exp} EXP)`);

module.exports = {
	OBJECTIVES,
	DAILY_POOL,
	WEEKLY_POOL,
	DAILY_COUNT,
	WEEKLY_COUNT,
	questsFor,
	rewardFor,
	recordProgress,
	questBoard,
	completedLines,
};
