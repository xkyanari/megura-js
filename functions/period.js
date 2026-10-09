/**
 * Day and week keys (UTC) for quests and faction scores. Weeks are ISO weeks,
 * starting on Monday.
 */

const DAY = 24 * 60 * 60 * 1000;

const dayKey = (now = Date.now()) => `d:${new Date(now).toISOString().slice(0, 10)}`;

// ISO week: the week belongs to the year of its Thursday
const weekKey = (now = Date.now()) => {
	const date = new Date(now);
	const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7)));
	const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
	const week = 1 + Math.floor((thursday - yearStart) / DAY / 7);
	return `w:${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const nextDayStart = (now = Date.now()) => {
	const date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
};

const nextWeekStart = (now = Date.now()) => {
	const date = new Date(now);
	const daysToMonday = 7 - ((date.getUTCDay() + 6) % 7);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + daysToMonday);
};

const previousWeekKey = (now = Date.now()) => weekKey(now - 7 * DAY);

module.exports = { dayKey, weekKey, previousWeekKey, nextDayStart, nextWeekStart };
