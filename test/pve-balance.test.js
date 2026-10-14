const { test } = require('node:test');
const assert = require('node:assert');
const { monsterStats, attackPerLevel, defensePerLevel, healthPerLevel } = require('../src/vars');
const { simulateBattle } = require('../functions/battle');
const mobs = require('../assets/mob_db.json');

// Plays FIGHTS_PER_MOB fights against every monster in mob_db.json, instantly.
const FIGHTS_PER_MOB = 30;
const noWait = async () => undefined;
const winRate = async (level, attackBonus = 0) => {
	const player = {
		playerName: 'P',
		level,
		totalHealth: healthPerLevel(level),
		totalAttack: attackPerLevel(level) + attackBonus,
		totalDefense: defensePerLevel(level),
	};
	let wins = 0;
	let fights = 0;
	for (const mob of mobs) {
		const monster = { playerName: mob.monsterName, ...monsterStats(mob, level) };
		for (let i = 0; i < FIGHTS_PER_MOB; i++) {
			if (await simulateBattle(null, player, monster, { render: noWait, delay: noWait }) === player) wins++;
			fights++;
		}
	}
	return wins / fights;
};

for (const level of [1, 5, 10, 20, 40, 60]) {
	test(`level ${level}: a player with no gear wins most fights, and gear helps without making it automatic`, async () => {
		const bare = await winRate(level);
		assert.ok(bare >= 0.5 && bare <= 0.75, `no gear: ${(bare * 100).toFixed(1)}% wins`);

		const geared = await winRate(level, Math.round(attackPerLevel(level) * 0.15));
		assert.ok(geared > bare, `gear: ${(geared * 100).toFixed(1)}% vs ${(bare * 100).toFixed(1)}%`);
		assert.ok(geared < 0.95, `gear: ${(geared * 100).toFixed(1)}% wins`);
	});
}

test('monster rewards grow with the player\'s level', () => {
	const [mob] = mobs;
	assert.equal(monsterStats(mob, 1).expDropped, mob.expDropped);
	assert.equal(monsterStats(mob, 10).expDropped, mob.expDropped * 10);
	assert.equal(monsterStats(mob, 10).iuraDropped, mob.iuraDropped * 10);
	assert.equal(monsterStats(mob, 10).level, 10);
});
