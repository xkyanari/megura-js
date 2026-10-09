const { randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const { Player, Monster, BossFight, BossConfig, Guild, sequelize } = require('../src/db');
const { monsterStats, attackMultiplier, getCriticalHitRate, expPoints } = require('../src/vars');
const { isFeatureEnabled } = require('../src/feature');
const { hpBar } = require('./battle');
const { rollLoot } = require('./loot');
const leveling = require('./level');

/**
 * Boss fights (behind the hasBosses feature flag), solo (/boss challenge) or
 * group world bosses (/boss spawn, or random spawns set with /boss autospawn).
 *
 * Every turn the boss telegraphs a move, and each fighter has a short, random
 * window to pick its counter from shuffled buttons:
 *   smash → Dodge, pierce → Guard, channel → Strike.
 * A counter hits back harder and takes no damage. A fighter who doesn't pick
 * fights on its own at half strength and takes the full hit, so a fight can't
 * be left to idle, and nothing fixed can be clicked by a macro: the right
 * button changes turn to turn, moves are described in varied words, and
 * button IDs carry the turn, so a click from an old turn doesn't count.
 *
 * Fights run in this process (like brawls). The BossFight row records each one,
 * so a restart marks running fights 'interrupted' instead of leaving them open.
 */

const MOVES = {
	smash: {
		counter: 'dodge',
		telegraphs: [
			'raises both arms high overhead…',
			'rears back, the ground cracking beneath it…',
			'winds up a crushing blow…',
			'leaps into the air, aiming to land on you…',
		],
	},
	pierce: {
		counter: 'guard',
		telegraphs: [
			'lowers its head and points a jagged spike at you…',
			'draws back a needle-sharp claw…',
			'narrows its eyes and lunges forward…',
			'coils up like a spring, aiming straight for you…',
		],
	},
	channel: {
		counter: 'strike',
		telegraphs: [
			'begins chanting in a forgotten tongue…',
			'gathers a swirling dark energy…',
			'closes its eyes, drawing power from the air…',
			'glows brighter and brighter…',
		],
	},
};

const ACTIONS = {
	strike: { label: 'Strike', emoji: '⚔️' },
	guard: { label: 'Guard', emoji: '🛡️' },
	dodge: { label: 'Dodge', emoji: '💨' },
};

const SOLO_HP_MULTIPLIER = 3;
// a group boss has this share of every fighter's solo boss health
const GROUP_HP_SHARE = 0.8;
const BOSS_ATTACK_MULTIPLIER = 1.2;
const COUNTER_BONUS = 1.5;
const IDLE_DAMAGE = 0.5;
const GUARD_REDUCTION = 0.5;
const SOLO_MAX_TURNS = 12;
const GROUP_MAX_TURNS = 15;
const WINDOW_MIN = 8000;
const WINDOW_MAX = 15000;
const MAX_PARTICIPANTS = 25;
const REWARD_IURA = 5;
const REWARD_EXP = 3;
// acting in at least this share of the turns you were standing earns the loot drop
const ACTIVE_SHARE = 0.5;
const SOLO_COOLDOWN = 6 * 60 * 60 * 1000;
const MIN_AUTOSPAWN_HOURS = 1;
const MAX_AUTOSPAWN_HOURS = 168;

const randomFloat = () => randomInt(1_000_000) / 1_000_000;
const pick = (list, random) => list[Math.floor(random() * list.length)];

const shuffled = (list, random) => {
	const copy = [...list];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
};

// The fights running in this process, by BossFight id.
const fights = new Map();

const fighterFor = (player, mob) => {
	const stats = monsterStats(mob, player.level);
	return {
		discordID: player.discordID,
		accountID: player.accountID,
		playerName: player.playerName,
		level: player.level,
		maxHealth: player.totalHealth,
		health: player.totalHealth,
		totalAttack: player.totalAttack,
		totalDefense: player.totalDefense,
		bossAttack: Math.round(stats.totalAttack * BOSS_ATTACK_MULTIPLIER),
		bossDefense: stats.totalDefense,
		soloHealth: stats.totalHealth * SOLO_HP_MULTIPLIER,
		damage: 0,
		actedTurns: 0,
		standingTurns: 0,
		knockedOut: false,
	};
};

const bossHealthFor = (kind, fighters) => {
	const total = fighters.reduce((sum, fighter) => sum + fighter.soloHealth, 0);
	return Math.round(kind === 'solo' ? total : total * GROUP_HP_SHARE);
};

const standing = (fight) => [...fight.fighters.values()].filter((fighter) => !fighter.knockedOut);

/**
 * Resolves one turn: every standing fighter's choice (missing = idle) against
 * the boss's move. Changes the fight and returns what happened.
 */
const resolveTurn = (fight, move, choices, random = Math.random) => {
	const { counter } = MOVES[move];
	const outcome = { countered: [], traded: [], guarded: [], missed: [], idle: [], knockedOut: [], dealt: 0 };

	for (const fighter of standing(fight)) {
		const action = choices.get(fighter.discordID);
		fighter.standingTurns += 1;
		if (action) fighter.actedTurns += 1;

		const crit = random() < getCriticalHitRate(fighter.level) ? 2 : 1;
		const hit = Math.max(fighter.totalAttack * attackMultiplier(fighter.level) * crit - fighter.bossDefense, 0);
		const bossHit = Math.max(fighter.bossAttack * attackMultiplier(fighter.level) - fighter.totalDefense, 0);

		let dealt;
		let taken;
		if (action === counter) {
			[dealt, taken] = [hit * COUNTER_BONUS, 0];
			outcome.countered.push(fighter);
		}
		else if (action === 'strike') {
			[dealt, taken] = [hit, bossHit];
			outcome.traded.push(fighter);
		}
		else if (action === 'guard') {
			[dealt, taken] = [0, bossHit * GUARD_REDUCTION];
			outcome.guarded.push(fighter);
		}
		else if (action === 'dodge') {
			[dealt, taken] = [0, bossHit];
			outcome.missed.push(fighter);
		}
		else {
			[dealt, taken] = [hit * IDLE_DAMAGE, bossHit];
			outcome.idle.push(fighter);
		}

		fighter.damage += dealt;
		fight.boss.health -= dealt;
		outcome.dealt += dealt;
		fighter.health -= taken;
		if (fighter.health <= 0) {
			fighter.health = 0;
			fighter.knockedOut = true;
			outcome.knockedOut.push(fighter);
		}
	}
	return outcome;
};

const names = (fighters) => fighters.map((fighter) => `\`${fighter.playerName}\``).join(', ');

const describeTurn = (fight, turn, move, outcome) => {
	const parts = [];
	if (outcome.countered.length) parts.push(`✅ ${names(outcome.countered)} countered`);
	if (outcome.traded.length) parts.push(`⚔️ ${names(outcome.traded)} traded blows`);
	if (outcome.guarded.length) parts.push(`🛡️ ${names(outcome.guarded)} braced`);
	if (outcome.missed.length) parts.push(`💥 ${names(outcome.missed)} dodged the wrong way`);
	if (outcome.idle.length) parts.push(`💤 ${names(outcome.idle)} hesitated`);
	if (outcome.knockedOut.length) parts.push(`☠️ ${names(outcome.knockedOut)} fell`);
	return `**Turn ${turn}** (${move}, ${Math.round(outcome.dealt)} damage): ${parts.join('; ')}`;
};

/**
 * Rewards for a won fight: IURA and EXP from the boss, scaled by each fighter's
 * share of the damage in a group, and a loot drop for those who acted.
 */
const computeRewards = (fight) => {
	const fighters = [...fight.fighters.values()];
	const average = fighters.reduce((sum, fighter) => sum + fighter.damage, 0) / fighters.length;
	return fighters.map((fighter) => {
		const share = fight.kind === 'solo' || average === 0 ? 1 : Math.min(fighter.damage / average, 1);
		const factor = 0.5 + 0.5 * share;
		return {
			fighter,
			iura: Math.max(Math.round(fight.mob.iuraDropped * fighter.level * REWARD_IURA * factor), 1),
			exp: Math.max(Math.round(fight.mob.expDropped * fighter.level * REWARD_EXP * factor), 1),
			loot: fighter.actedTurns > 0 && fighter.actedTurns >= Math.ceil(fighter.standingTurns * ACTIVE_SHARE),
		};
	});
};

// Pays one fighter. Returns their line for the results, or null without a profile.
const payReward = async (fight, reward) => {
	const player = await Player.findByPk(reward.fighter.accountID);
	if (!player) return null;
	await player.addIura(reward.iura);
	await player.increment({ iuraEarned: reward.iura, expGained: reward.exp });
	const loot = reward.loot ? await rollLoot(player, fight.mob.monsterName, { guaranteed: true }) : null;

	let levelText = '';
	await player.reload();
	if (player.expGained >= expPoints(player.level)) {
		const { level } = await leveling(player.guildID, player.discordID);
		levelText = ` ⬆️ level ${level}!`;
	}
	return `${userMention(player.discordID)}: ${reward.iura} IURA, ${reward.exp} EXP${loot ? `, 🎁 ${loot}` : ''}${levelText}`;
};

// Pays the rewards. Returns a line per fighter paid.
const payRewards = async (fight, rewards) => {
	const lines = [];
	for (const reward of rewards) {
		try {
			lines.push(await payReward(fight, reward));
		}
		catch (error) {
			// one fighter's broken profile mustn't cost everyone else their reward
			console.error(`Boss reward for ${reward.fighter.discordID} failed:`, error);
		}
	}
	return lines.filter(Boolean);
};

const bossLine = (boss) =>
	`**${boss.name}**\n${hpBar(boss.health, boss.maxHealth)} ${Math.max(0, Math.round(boss.health))}/${boss.maxHealth} HP`;

const fighterLine = (fighter) =>
	`**${fighter.playerName}** (Lv ${fighter.level})\n${hpBar(fighter.health, fighter.maxHealth)} ${Math.round(fighter.health)}/${fighter.maxHealth} HP`;

const fightEmbed = (fight, { status, footer } = {}) => {
	const fighters = [...fight.fighters.values()];
	const party = fight.kind === 'solo'
		? fighterLine(fighters[0])
		: `👥 ${standing(fight).length}/${fighters.length} fighters standing`;
	const embed = new EmbedBuilder()
		.setColor(0x8b0000)
		.setTitle(`👹 ${fight.boss.name}`)
		.setThumbnail(fight.boss.imageURL ?? null)
		.setDescription([bossLine(fight.boss), party, status, fight.log.slice(-5).join('\n')].filter(Boolean).join('\n\n').slice(0, 4000));
	if (footer) embed.setFooter({ text: footer });
	return embed;
};

const actionRow = (fight, turn, random) => new ActionRowBuilder().addComponents(
	shuffled(Object.keys(ACTIONS), random).map((action) => new ButtonBuilder()
		.setCustomId(`boss:${fight.id}:${turn}:${action}`)
		.setLabel(ACTIONS[action].label)
		.setEmoji(ACTIONS[action].emoji)
		.setStyle(ButtonStyle.Secondary)),
);

const joinRow = (fight) => new ActionRowBuilder().addComponents(
	new ButtonBuilder().setCustomId(`boss:${fight.id}:join`).setLabel('Join the fight').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
);

/**
 * Records a fighter's move for the current turn: the first click is final.
 * Returns { ok: true, action } or { ok: false, reason }.
 */
const recordChoice = (fightId, turn, userId, action) => {
	const fight = fights.get(Number(fightId));
	if (!fight || fight.phase !== 'turn' || fight.turn !== Number(turn)) return { ok: false, reason: 'closed' };
	if (!ACTIONS[action]) return { ok: false, reason: 'closed' };
	const fighter = fight.fighters.get(userId);
	if (!fighter) return { ok: false, reason: 'not in fight' };
	if (fighter.knockedOut) return { ok: false, reason: 'knocked out' };
	if (fight.choices.has(userId)) return { ok: false, reason: 'chosen' };
	fight.choices.set(userId, action);
	return { ok: true, action };
};

/**
 * Adds a member to a group boss while it is gathering fighters.
 * Returns { ok: true, count } or { ok: false, reason }.
 */
const joinFight = async (fightId, userId) => {
	const fight = fights.get(Number(fightId));
	if (!fight || fight.kind !== 'group' || fight.phase !== 'joining') return { ok: false, reason: 'closed' };
	if (fight.joining.has(userId)) return { ok: false, reason: 'joined' };
	if (fight.joining.size >= MAX_PARTICIPANTS) return { ok: false, reason: 'full' };
	const player = await Player.findOne({ where: { discordID: userId, guildID: fight.guildID } });
	if (!player) return { ok: false, reason: 'no profile' };
	// checked again: another click may have joined while the profile loaded
	if (fight.phase !== 'joining' || fight.joining.has(userId) || fight.joining.size >= MAX_PARTICIPANTS) {
		return { ok: false, reason: fight.joining.has(userId) ? 'joined' : 'closed' };
	}
	fight.joining.set(userId, player);
	return { ok: true, count: fight.joining.size };
};

const isInFight = (guildID, userId) =>
	[...fights.values()].some((fight) => fight.guildID === guildID && (fight.fighters.has(userId) || fight.joining.has(userId)));

const hasGroupFightIn = (channelID) =>
	[...fights.values()].some((fight) => fight.kind === 'group' && fight.channelID === channelID);

/**
 * Runs a boss fight from start to finish.
 *
 * kind: 'solo' (with `player`) or 'group' (fighters join for `joinMs`).
 * io.show(embed, components) shows the fight (one message, edited),
 * io.wait(ms) waits (tests use it to click). Returns the finished fight.
 */
const runBossFight = async ({ kind, guildID, channelID, player, intro, joinMs = 60000, io, random = randomFloat }) => {
	const [mob] = await Monster.findAll({ order: sequelize.random(), limit: 1 });
	if (!mob) throw new Error('no monsters configured');

	const record = await BossFight.create({ guildID, channelID, kind, discordID: player?.discordID ?? null, monsterName: mob.monsterName });
	const fight = {
		id: record.id,
		kind,
		guildID,
		channelID,
		mob,
		boss: { name: mob.monsterName, imageURL: mob.imageURL, health: 0, maxHealth: 0 },
		fighters: new Map(),
		joining: new Map(),
		choices: new Map(),
		phase: 'joining',
		turn: 0,
		log: intro ? [intro] : [],
	};
	fights.set(fight.id, fight);

	try {
		let players;
		if (kind === 'solo') {
			players = [player];
			fight.joining.set(player.discordID, player);
		}
		else {
			const until = Math.floor((Date.now() + joinMs) / 1000);
			await io.show(fightEmbed(fight, { status: `A world boss appears! Join before <t:${until}:R> and fight it together.` }), [joinRow(fight)]);
			await io.wait(joinMs);
			players = [...fight.joining.values()];
		}

		if (!players.length) {
			fight.phase = 'over';
			await record.update({ status: 'lost' });
			await io.show(fightEmbed(fight, { status: `Nobody answered the call. **${mob.monsterName}** wanders off…` }), []);
			return fight;
		}

		for (const p of players) fight.fighters.set(p.discordID, fighterFor(p, mob));
		fight.boss.maxHealth = bossHealthFor(kind, [...fight.fighters.values()]);
		fight.boss.health = fight.boss.maxHealth;

		const maxTurns = kind === 'solo' ? SOLO_MAX_TURNS : GROUP_MAX_TURNS;
		while (fight.boss.health > 0 && standing(fight).length && fight.turn < maxTurns) {
			fight.turn += 1;
			const move = pick(Object.keys(MOVES), random);
			const windowMs = WINDOW_MIN + Math.floor(random() * (WINDOW_MAX - WINDOW_MIN));
			const closes = Math.floor((Date.now() + windowMs) / 1000);
			fight.choices = new Map();
			fight.phase = 'turn';
			await io.show(fightEmbed(fight, {
				status: `**Turn ${fight.turn}/${maxTurns}:** ${mob.monsterName} ${pick(MOVES[move].telegraphs, random)}\nReact <t:${closes}:R>!`,
				footer: 'Read the move and pick the counter. Hesitating means half damage and a full hit.',
			}), [actionRow(fight, fight.turn, random)]);
			await io.wait(windowMs);
			fight.phase = 'resolving';
			fight.log.push(describeTurn(fight, fight.turn, move, resolveTurn(fight, move, fight.choices, random)));
		}

		fight.phase = 'over';
		const won = fight.boss.health <= 0;
		fight.boss.health = Math.max(fight.boss.health, 0);
		await record.update({ status: won ? 'won' : 'lost' });

		if (!won) {
			const reason = standing(fight).length ? `**${mob.monsterName}** retreats into the shadows.` : 'Every fighter has fallen.';
			await io.show(fightEmbed(fight, { status: `😔 ${reason} No rewards this time.` }), []);
			return fight;
		}

		const rewardLines = await payRewards(fight, computeRewards(fight));
		await io.show(fightEmbed(fight, { status: `🏆 **${mob.monsterName}** is defeated!\n${rewardLines.join('\n')}`.slice(0, 2500) }), []);
		return fight;
	}
	catch (error) {
		await record.update({ status: 'interrupted' }).catch(() => null);
		throw error;
	}
	finally {
		fights.delete(fight.id);
	}
};

// Shows a fight in a channel: one message, sent then edited.
const channelIO = (channel) => {
	let message;
	return {
		show: async (embed, components) => {
			if (!message) message = await channel.send({ embeds: [embed], components });
			else await message.edit({ embeds: [embed], components });
		},
		wait: require('node:timers/promises').setTimeout,
	};
};

// Fights still marked running belonged to a process that stopped: close them.
const closeInterruptedFights = () =>
	BossFight.update({ status: 'interrupted' }, { where: { status: 'running' } });

// Random spawns ------------------------------------------------

const autoSpawnDelay = (intervalHours, random = Math.random) =>
	Math.round(intervalHours * 60 * 60 * 1000 * (0.5 + random()));

const pendingSpawnJobs = async (queue, guildID) => {
	const jobs = await queue.getJobs(['waiting', 'delayed']);
	return jobs.filter((job) => job.data.guildID === guildID);
};

// Replaces the server's next random spawn with one about intervalHours from now.
const scheduleAutoSpawn = async (queue, guildID, intervalHours, random = Math.random) => {
	for (const job of await pendingSpawnJobs(queue, guildID)) await job.remove();
	const delay = autoSpawnDelay(intervalHours, random);
	await queue.add({ guildID }, { jobId: `boss-${guildID}-${Date.now() + delay}`, delay, removeOnComplete: true, removeOnFail: true });
	return delay;
};

const cancelAutoSpawn = async (queue, guildID) => {
	for (const job of await pendingSpawnJobs(queue, guildID)) await job.remove();
};

// Sets (hours > 0) or turns off random spawns for a server.
const configureAutoSpawn = async (queue, guildID, channelID, hours) => {
	if (!hours) {
		await BossConfig.destroy({ where: { guildID } });
		await cancelAutoSpawn(queue, guildID);
		return null;
	}
	await BossConfig.upsert({ guildID, channelID, intervalHours: hours });
	return scheduleAutoSpawn(queue, guildID, hours);
};

// Runs a random spawn job, then schedules the next one.
const processAutoSpawn = async (client, queue, { guildID }) => {
	const config = await BossConfig.findByPk(guildID);
	if (!config) return false;
	await scheduleAutoSpawn(queue, guildID, config.intervalHours);

	const guild = await Guild.findOne({ where: { guildID } });
	if (!guild || !await isFeatureEnabled(guild.subscription, 'hasBosses')) return false;
	if (hasGroupFightIn(config.channelID)) return false;
	const channel = await client.channels.fetch(config.channelID).catch(() => null);
	if (!channel) return false;

	// the fight runs on its own: the job only starts it
	runBossFight({ kind: 'group', guildID, channelID: channel.id, io: channelIO(channel) })
		.catch((error) => console.error(`Boss fight in ${guildID} failed:`, error));
	return true;
};

// At startup: every server with random spawns gets its next spawn scheduled.
const syncAutoSpawns = async (queue) => {
	for (const config of await BossConfig.findAll()) {
		if (!(await pendingSpawnJobs(queue, config.guildID)).length) {
			await scheduleAutoSpawn(queue, config.guildID, config.intervalHours);
		}
	}
};

module.exports = {
	MOVES,
	ACTIONS,
	SOLO_COOLDOWN,
	MIN_AUTOSPAWN_HOURS,
	MAX_AUTOSPAWN_HOURS,
	MAX_PARTICIPANTS,
	fights,
	fighterFor,
	bossHealthFor,
	resolveTurn,
	computeRewards,
	recordChoice,
	joinFight,
	isInFight,
	hasGroupFightIn,
	runBossFight,
	channelIO,
	closeInterruptedFights,
	autoSpawnDelay,
	scheduleAutoSpawn,
	configureAutoSpawn,
	processAutoSpawn,
	syncAutoSpawns,
};
