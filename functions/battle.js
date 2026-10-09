const { EmbedBuilder } = require('discord.js');
const { attackMultiplier, getCriticalHitRate } = require('../src/vars');

// A battle where neither side can hurt the other would never end.
const MAX_ROUNDS = 50;
// Discord embeds hold 4096 characters; show the latest lines.
const MAX_LOG_LINES = 25;
const logText = (lines) => lines.slice(-MAX_LOG_LINES).join('\n').slice(-4000);

const getDamage = (player1, player2, criticalHitMultiplier) => {
	const damage =
		player1.totalAttack * criticalHitMultiplier - player2.totalDefense;
	const finalDamage = Math.max(damage, 0);

	const remainingHealth = player2.totalHealth - finalDamage;

	return { finalDamage, remainingHealth };
};

const attack = async (interaction, player1, player2, criticalHitRate, existingBattleLogs = [], message) => {
	const isCriticalHit = Math.random() < criticalHitRate;
	const finalAttackMultiplier = isCriticalHit ?
		attackMultiplier(player1.level) * 2 :
		attackMultiplier(player1.level);
	const { finalDamage, remainingHealth } = getDamage(
		player1,
		player2,
		finalAttackMultiplier,
	);

	const messageText = `\`${player1.playerName}\` attacks \`${player2.playerName}\` for ${Math.round(
		finalDamage,
	)} damage${isCriticalHit ? ' (critical hit)!' : ''}. \`${player2.playerName}\` has **${Math.max(0, Math.round(remainingHealth))}** health remaining.`;

	existingBattleLogs.push(messageText);

	const embed = new EmbedBuilder()
		.setColor(0xcd7f32)
		.setTitle('Battle Logs')
		.setDescription(logText(existingBattleLogs));

	if (!message) {
		message = await interaction.channel.send({ embeds: [embed] });
	}
	else {
		await message.edit({ embeds: [embed] });
	}

	if (Math.max(0, Math.round(remainingHealth)) === 0) {
		existingBattleLogs.push(`\`${player2.playerName}\` dodged the final attack and gave up.`);
		embed.setDescription(logText(existingBattleLogs));
		await message.edit({ embeds: [embed] });
	}

	player2.totalHealth = remainingHealth;

	return { remainingHealth, battleLogs: existingBattleLogs, message };
};

const simulateBattle = async (interaction, player1, player2) => {
	const wait = require('node:timers/promises').setTimeout;
	const playerA = player1;
	const playerB = player2;

	const criticalHitRateA = getCriticalHitRate(playerA.level);
	const criticalHitRateB = getCriticalHitRate(playerB.level);

	let remainingHealthA = playerA.totalHealth;
	let remainingHealthB = playerB.totalHealth;

	let winner = '';
	let battleLogs = [];
	let message;

	const firstAttackResult = await attack(interaction, playerA, playerB, criticalHitRateA, battleLogs, message);
	remainingHealthB = firstAttackResult.remainingHealth;
	battleLogs = firstAttackResult.battleLogs;
	message = firstAttackResult.message;
	if (remainingHealthB <= 0) {
		winner = playerA;
		return winner;
	}
	await wait(2000);

	let rounds = 0;
	while (remainingHealthA > 0 && remainingHealthB > 0) {
		if (++rounds > MAX_ROUNDS) {
			// neither side is getting anywhere: call it a draw (no winner)
			await interaction.channel.send('Both fighters are exhausted. The battle ends in a draw.');
			break;
		}

		const attackResultB = await attack(
			interaction,
			playerB,
			playerA,
			criticalHitRateB,
			battleLogs,
			message,
		);
		remainingHealthA = attackResultB.remainingHealth;
		battleLogs = attackResultB.battleLogs;
		message = attackResultB.message;

		if (remainingHealthA <= 0) {
			winner = playerB;
			break;
		}

		await wait(2000);

		const attackResultA = await attack(
			interaction,
			playerA,
			playerB,
			criticalHitRateA,
			battleLogs,
			message,
		);
		remainingHealthB = attackResultA.remainingHealth;
		battleLogs = attackResultA.battleLogs;
		message = attackResultA.message;

		if (remainingHealthB <= 0) {
			winner = playerA;
			break;
		}

		await wait(2000);
	}
	return winner;
};

module.exports = {
	simulateBattle,
	getDamage,
};
