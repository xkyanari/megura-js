const { gameEmbed, formatNumber, progressBar } = require('./embedStyle');
const { attackMultiplier, getCriticalHitRate } = require('../src/vars');

// A battle where neither side can hurt the other would never end.
const MAX_ROUNDS = 50;
// How many of the latest log lines the battle embed shows.
const MAX_LOG_LINES = 8;
const TURN_DELAY = 1500;
// Consumables are used when health drops below this share, at most MAX_CONSUMABLES times a battle.
const CONSUMABLE_THRESHOLD = 0.35;
const MAX_CONSUMABLES = 2;

const getDamage = (player1, player2, criticalHitMultiplier) => {
	const damage =
		player1.totalAttack * criticalHitMultiplier - player2.totalDefense;
	const finalDamage = Math.max(damage, 0);

	const remainingHealth = player2.totalHealth - finalDamage;

	return { finalDamage, remainingHealth };
};

const hpBar = progressBar;

const hpLine = (fighter) =>
	`\`${hpBar(fighter.totalHealth, fighter.maxHealth)}\`\n**${formatNumber(Math.max(0, Math.round(fighter.totalHealth)))}** / ${formatNumber(Math.round(fighter.maxHealth))} HP`;

const battleEmbed = (a, b, logs, { title = 'Battle', thumbnail } = {}) => {
	const embed = gameEmbed()
		.setTitle(title)
		.addFields(
			{ name: `⚔️ ${a.playerName} · Lv ${a.level}`.slice(0, 256), value: hpLine(a), inline: true },
			{ name: `🛡️ ${b.playerName} · Lv ${b.level}`.slice(0, 256), value: hpLine(b), inline: true },
		)
		.setDescription(logs.length
			? `**Combat log**\n${logs.slice(-MAX_LOG_LINES).join('\n')}`.slice(0, 4000)
			: '*The fighters take their positions…*');
	if (thumbnail) embed.setThumbnail(thumbnail);
	return embed;
};

// The first time, posts the battle in the channel; after that, edits that message.
const channelRenderer = (interaction) => {
	let message;
	return async (embed) => {
		if (!message) message = await interaction.channel.send({ embeds: [embed] });
		else await message.edit({ embeds: [embed] });
	};
};

const toFighter = (player) => ({
	playerName: player.playerName,
	level: player.level,
	totalHealth: player.totalHealth,
	maxHealth: player.totalHealth,
	totalAttack: player.totalAttack,
	totalDefense: player.totalDefense,
});

const strike = (attacker, defender, logs) => {
	const isCriticalHit = Math.random() < getCriticalHitRate(attacker.level);
	const multiplier = attackMultiplier(attacker.level) * (isCriticalHit ? 2 : 1);
	const { finalDamage, remainingHealth } = getDamage(attacker, defender, multiplier);
	defender.totalHealth = remainingHealth;
	logs.push(`\`${attacker.playerName}\` hits \`${defender.playerName}\` for ${Math.round(finalDamage)}${isCriticalHit ? ' (critical hit!)' : ''}.`);
};

/**
 * Uses one of the fighter's consumables if their health is low. Each consumable
 * is { itemName, totalHealth, totalAttack, totalDefense, consume }, where
 * consume() takes one from the inventory and resolves false if none is left.
 */
const useConsumable = async (fighter, consumables, state, logs) => {
	if (state.used >= MAX_CONSUMABLES || fighter.totalHealth <= 0) return;
	if (fighter.totalHealth >= fighter.maxHealth * CONSUMABLE_THRESHOLD) return;

	while (consumables.length) {
		const item = consumables[0];
		if (!await item.consume()) {
			consumables.shift();
			continue;
		}
		state.used += 1;
		fighter.totalHealth = Math.min(fighter.totalHealth + item.totalHealth, fighter.maxHealth + item.totalHealth);
		fighter.totalAttack += item.totalAttack;
		fighter.totalDefense += item.totalDefense;
		const effects = [
			item.totalHealth && `+${item.totalHealth} HP`,
			item.totalAttack && `+${item.totalAttack} ATK`,
			item.totalDefense && `+${item.totalDefense} DEF`,
		].filter(Boolean).join(', ');
		logs.push(`🧪 \`${fighter.playerName}\` uses ${item.itemName} (${effects}).`);
		return;
	}
};

/**
 * Fights player1 against player2, player1 striking first, and returns the
 * winner (player1 or player2 as passed in), or '' for a draw. The inputs are
 * not changed.
 *
 * options.render(embed) shows each turn (default: one message in the channel),
 * options.consumables are player1's (see useConsumable), options.delay waits between turns.
 */
const simulateBattle = async (interaction, player1, player2, options = {}) => {
	const {
		render = channelRenderer(interaction),
		consumables = [],
		delay = require('node:timers/promises').setTimeout,
		title,
		thumbnail,
	} = options;
	const a = toFighter(player1);
	const b = toFighter(player2);
	const logs = [];
	const consumableState = { used: 0 };
	const show = () => render(battleEmbed(a, b, logs, { title, thumbnail }));

	await show();
	for (let rounds = 1; rounds <= MAX_ROUNDS; rounds++) {
		await delay(TURN_DELAY);
		strike(a, b, logs);
		if (b.totalHealth <= 0) {
			logs.push(`\`${b.playerName}\` is defeated!`);
			await show();
			return player1;
		}
		strike(b, a, logs);
		if (a.totalHealth <= 0) {
			logs.push(`\`${a.playerName}\` is defeated!`);
			await show();
			return player2;
		}
		await useConsumable(a, consumables, consumableState, logs);
		await show();
	}

	// neither side is getting anywhere: call it a draw (no winner)
	logs.push('Both fighters are exhausted. The battle ends in a draw.');
	await show();
	return '';
};

module.exports = {
	simulateBattle,
	getDamage,
	hpBar,
	battleEmbed,
	CONSUMABLE_THRESHOLD,
	MAX_CONSUMABLES,
};
