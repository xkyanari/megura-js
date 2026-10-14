const { sequelize, Player, moveIura } = require('../src/db');

/**
 * Daily quest rewards. Claiming again within STREAK_WINDOW of the last claim
 * keeps the streak going; each day of streak adds STREAK_BONUS to the reward,
 * up to MAX_STREAK_BONUS_DAYS days' worth. (The 24h cooldown is /daily's own.)
 */

const STREAK_WINDOW = 48 * 60 * 60 * 1000;
const STREAK_BONUS = 0.1;
const MAX_STREAK_BONUS_DAYS = 6;

const nextStreak = (lastDailyAt, streak, now) =>
	(lastDailyAt && now - new Date(lastDailyAt).getTime() < STREAK_WINDOW ? streak + 1 : 1);

const streakReward = (questReward, streak) =>
	Math.floor(questReward * (1 + STREAK_BONUS * Math.min(Math.max(streak - 1, 0), MAX_STREAK_BONUS_DAYS)));

// Pays the quest reward with the streak bonus. Returns { streak, reward }.
const claimDaily = (accountID, questReward, now = Date.now()) => sequelize.transaction(async (transaction) => {
	const player = await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
	if (!player) throw new Error('profile not found');

	const streak = nextStreak(player.lastDailyAt, player.dailyStreak, now);
	const reward = streakReward(questReward, streak);
	await player.update({ dailyStreak: streak, lastDailyAt: new Date(now) }, { transaction });
	if (reward > 0) {
		await moveIura(accountID, null, 'wallet', reward, transaction);
		await player.increment({ iuraEarned: reward }, { transaction });
	}
	return { streak, reward };
});

module.exports = { STREAK_WINDOW, STREAK_BONUS, MAX_STREAK_BONUS_DAYS, nextStreak, streakReward, claimDaily };
