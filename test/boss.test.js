const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Queue = require('bull');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Player, Iura, Item, Shop, Monster, Guild, BossFight, BossConfig } = require('../src/db');
const B = require('../functions/boss');
const bossCommand = require('../commands/slash-commands/boss');
const bossButton = require('../components/buttons/boss');
const items = require('../assets/item_db.json');
const mobs = require('../assets/mob_db.json');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GB';
const queue = new Queue(`bossTest${Date.now()}`, redisURL);
const exampleFeatures = process.env.FEATURES_FILE;
const featuresFile = path.join(os.tmpdir(), `features-boss-${process.pid}.json`);

const makePlayer = async (discordID, extra = {}) => {
	const player = await Player.create({ discordID, guildID: G, playerName: discordID, ...extra });
	await Iura.create({ accountID: player.accountID, walletAmount: 0, walletName: `w${discordID}`, bankName: `b${discordID}` });
	return player;
};
const walletOf = async (player) => (await Iura.findByPk(player.accountID)).walletAmount;
const itemCount = async (player) => (await Item.sum('quantity', { where: { accountID: player.accountID } })) ?? 0;

// The move the boss telegraphed in this embed, read the way a player would.
const telegraphedMove = (embed) => Object.keys(B.MOVES).find((move) =>
	B.MOVES[move].telegraphs.some((line) => embed.data.description.includes(line)));

/**
 * An io for runBossFight that records what is shown and, while a turn is open,
 * lets each scripted fighter click: strategy(move) returns the action, or
 * undefined to sit the turn out. `beforeFight` runs during the join window.
 */
const scriptedIO = ({ strategies = {}, beforeFight } = {}) => {
	const shown = [];
	let last;
	return {
		shown,
		show: async (embed, components) => {
			last = { embed, components };
			shown.push(last);
		},
		wait: async () => {
			const turnButton = last.components[0]?.components[0]?.data.custom_id;
			if (turnButton?.endsWith(':join')) {
				await beforeFight?.(turnButton.split(':')[1]);
				return;
			}
			if (!turnButton) return;
			const [, fightId, turn] = turnButton.split(':');
			const move = telegraphedMove(last.embed);
			for (const [userId, strategy] of Object.entries(strategies)) {
				const action = strategy(move);
				if (action) B.recordChoice(fightId, turn, userId, action);
			}
		},
	};
};
const perfect = (move) => B.MOVES[move].counter;
const idle = () => undefined;

before(async () => {
	const features = JSON.parse(fs.readFileSync(exampleFeatures, 'utf8'));
	features.premium.hasBosses = true;
	fs.writeFileSync(featuresFile, JSON.stringify(features));
	process.env.FEATURES_FILE = featuresFile;

	await resetDb();
	await Shop.bulkCreate(items);
	await Monster.create(mobs[0]);
	await Guild.create({ guildID: G, subscription: 'premium' });
	await Guild.create({ guildID: 'GFREE', subscription: 'free' });
});
after(async () => {
	process.env.FEATURES_FILE = exampleFeatures;
	fs.rmSync(featuresFile, { force: true });
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('turns', () => {
	const fightOf = (...fighters) => ({
		kind: 'group',
		boss: { health: 1e9, maxHealth: 1e9 },
		fighters: new Map(fighters.map((f) => [f.discordID, f])),
	});
	const fighter = (discordID) => B.fighterFor({ discordID, accountID: 0, playerName: discordID, level: 1, totalHealth: 2000, totalAttack: 500, totalDefense: 500 }, mobs[0]);
	const noCrit = () => 0.99;

	test('a counter hits hardest and takes nothing; idling hits at half and takes the full blow', () => {
		const [counter, striker, wrongDodge, sleeper] = ['C', 'S', 'D', 'I'].map(fighter);
		const fight = fightOf(counter, striker, wrongDodge, sleeper);
		// pierce is countered by Guard
		const choices = new Map([['C', 'guard'], ['S', 'strike'], ['D', 'dodge']]);
		// C guards (counter), S strikes, D dodges the wrong way, I does nothing
		const outcome = B.resolveTurn(fight, 'pierce', choices, noCrit);

		assert.deepEqual(outcome.countered.map((f) => f.discordID), ['C']);
		assert.deepEqual(outcome.traded.map((f) => f.discordID), ['S']);
		assert.deepEqual(outcome.missed.map((f) => f.discordID), ['D']);
		assert.deepEqual(outcome.idle.map((f) => f.discordID), ['I']);
		assert.equal(counter.health, 2000);
		assert.ok(counter.damage > striker.damage && striker.damage > sleeper.damage && sleeper.damage > 0);
		assert.equal(Math.round(sleeper.damage * 2), Math.round(striker.damage));
		assert.equal(striker.health, wrongDodge.health);
		assert.equal(sleeper.health, striker.health);
		assert.equal([counter, striker, wrongDodge].filter((f) => f.actedTurns === 1).length, 3);
		assert.equal(sleeper.actedTurns, 0);
	});

	test('guarding a move it doesn\'t counter halves the hit', () => {
		const [guard, sleeper] = ['G2', 'I2'].map(fighter);
		const fight = fightOf(guard, sleeper);
		B.resolveTurn(fight, 'smash', new Map([['G2', 'guard']]), noCrit);
		assert.ok(Math.abs((2000 - guard.health) * 2 - (2000 - sleeper.health)) < 1e-6, 'half the hit');
	});

	test('every move is countered by a different action, and every telegraph is unique', () => {
		const counters = Object.values(B.MOVES).map((move) => move.counter);
		assert.deepEqual([...new Set(counters)].sort(), Object.keys(B.ACTIONS).sort());
		const lines = Object.values(B.MOVES).flatMap((move) => move.telegraphs);
		assert.equal(new Set(lines).size, lines.length);
	});
});

describe('solo fights', () => {
	test('reading the moves wins, pays out by level and drops loot', async () => {
		const player = await makePlayer('SOLO1', { level: 3, totalHealth: 2350, totalAttack: 551, totalDefense: 520 });
		const io = scriptedIO({ strategies: { SOLO1: perfect } });
		const fight = await B.runBossFight({ kind: 'solo', guildID: G, channelID: 'C1', player, io });

		assert.equal(fight.boss.health, 0);
		assert.equal((await BossFight.findByPk(fight.id)).status, 'won');
		assert.ok(await walletOf(player) > 0);
		assert.equal(await itemCount(player), 1, 'one guaranteed drop');
		const final = io.shown.at(-1);
		assert.deepEqual(final.components, []);
		assert.match(final.embed.data.description, /is defeated/);
		assert.equal(B.fights.size, 0, 'finished fights are forgotten');
	});

	test('a player who never acts loses and gets nothing', async () => {
		const player = await makePlayer('SOLO2', { level: 3, totalHealth: 2350, totalAttack: 551, totalDefense: 520 });
		const fight = await B.runBossFight({ kind: 'solo', guildID: G, channelID: 'C1', player, io: scriptedIO({ strategies: { SOLO2: idle } }) });
		assert.ok(fight.boss.health > 0);
		assert.equal((await BossFight.findByPk(fight.id)).status, 'lost');
		assert.equal(await walletOf(player), 0);
		assert.equal(await itemCount(player), 0);
	});

	test('each turn shows the moves in a new order, with the turn in every button', async () => {
		const player = await makePlayer('SOLO3', { level: 3, totalHealth: 2350, totalAttack: 551, totalDefense: 520 });
		const io = scriptedIO({ strategies: { SOLO3: perfect } });
		await B.runBossFight({ kind: 'solo', guildID: G, channelID: 'C1', player, io });
		const turns = io.shown.filter((shot) => shot.components.length);
		turns.forEach((shot, i) => {
			for (const button of shot.components[0].components) assert.match(button.data.custom_id, new RegExp(`^boss:\\d+:${i + 1}:`));
		});
	});
});

describe('clicks', () => {
	test('first click is final, late clicks and outsiders are refused', async () => {
		const player = await makePlayer('CLK1', { level: 3, totalHealth: 2350, totalAttack: 551, totalDefense: 520 });
		const results = [];
		const io = scriptedIO();
		io.wait = async () => {
			const [, fightId, turn] = io.shown.at(-1).components[0].components[0].data.custom_id.split(':');
			if (Number(turn) !== 1) return;
			results.push(B.recordChoice(fightId, turn, 'CLK1', 'strike'));
			results.push(B.recordChoice(fightId, turn, 'CLK1', 'guard'));
			results.push(B.recordChoice(fightId, turn, 'STRANGER', 'guard'));
			results.push(B.recordChoice(fightId, 99, 'CLK1', 'guard'));
			results.push(B.recordChoice(fightId, turn, 'CLK1', 'nonsense'));
		};
		await B.runBossFight({ kind: 'solo', guildID: G, channelID: 'C1', player, io });
		assert.deepEqual(results.map((r) => r.ok ? 'ok' : r.reason), ['ok', 'chosen', 'not in fight', 'closed', 'closed']);
	});

	test('the button answers privately', async () => {
		const rec = recorder();
		await bossButton.execute({ customId: 'boss:424242:1:strike', user: { id: 'X' }, reply: async (p) => rec.push('reply', p) });
		await bossButton.execute({ customId: 'boss:424242:join', user: { id: 'X' }, reply: async (p) => rec.push('reply', p) });
		assert.deepEqual(rec.calls.map(([, p]) => [p.content, p.flags]), [
			['Too late: that turn is over.', 64],
			['This fight is no longer taking fighters.', 64],
		]);
	});
});

describe('group fights', () => {
	test('fighters who join share the fight; rewards follow damage, loot follows taking part', async () => {
		const stats = { level: 3, totalHealth: 2350, totalAttack: 551, totalDefense: 520 };
		const active = await makePlayer('GRP1', stats);
		const lazy = await makePlayer('GRP2', stats);
		await makePlayer('GRP3', stats);
		const joins = [];
		const io = scriptedIO({
			strategies: { GRP1: perfect, GRP2: idle },
			beforeFight: async (fightId) => {
				joins.push(await B.joinFight(fightId, 'GRP1'));
				joins.push(await B.joinFight(fightId, 'GRP1'));
				joins.push(await B.joinFight(fightId, 'GRP2'));
				joins.push(await B.joinFight(fightId, 'NOPROFILE'));
				assert.equal(B.isInFight(G, 'GRP1'), true);
				assert.equal(B.hasGroupFightIn('CG'), true);
			},
		});
		const fight = await B.runBossFight({ kind: 'group', guildID: G, channelID: 'CG', io });

		assert.deepEqual(joins.map((r) => r.ok ? r.count : r.reason), [1, 'joined', 2, 'no profile']);
		assert.equal(fight.fighters.size, 2);
		assert.equal(fight.boss.health, 0);
		const activeWallet = await walletOf(active);
		const lazyWallet = await walletOf(lazy);
		assert.ok(activeWallet > lazyWallet && lazyWallet > 0, `${activeWallet} vs ${lazyWallet}`);
		assert.equal(await itemCount(active), 1);
		assert.equal(await itemCount(lazy), 0, 'no loot for sitting it out');
		assert.equal(await B.joinFight(fight.id, 'GRP3').then((r) => r.reason), 'closed');
	});

	test('a fighter already in another boss fight can\'t join; joining brings the faction in step with the member\'s roles', async () => {
		await makePlayer('BUSY1');
		const syncing = await makePlayer('SYNC1');
		await Guild.update({ margarethaID: 'RM', cerberonID: 'RC' }, { where: { guildID: G } });
		// a solo fight elsewhere in the server
		B.fights.set(-1, { id: -1, kind: 'solo', guildID: G, channelID: 'ELSE', fighters: new Map([['BUSY1', {}]]), joining: new Map() });
		const joins = [];
		try {
			const io = scriptedIO({
				beforeFight: async (fightId) => {
					joins.push(await B.joinFight(fightId, 'BUSY1'));
					joins.push(await B.joinFight(fightId, 'SYNC1', { id: 'SYNC1', roles: ['RC'] }));
				},
			});
			await B.runBossFight({ kind: 'group', guildID: G, channelID: 'CBUSY', io });
		}
		finally {
			B.fights.delete(-1);
			await Guild.update({ margarethaID: null, cerberonID: null }, { where: { guildID: G } });
		}
		assert.deepEqual(joins.map((r) => r.ok ? r.count : r.reason), ['busy', 1]);
		assert.equal((await syncing.reload()).faction, 'Cerberon');
	});

	test('a channel is reserved before a world boss starts, and freed when it ends', async () => {
		assert.equal(B.reserveChannel('CR'), true);
		assert.equal(B.reserveChannel('CR'), false, 'a second spawn at the same moment is refused');
		assert.equal(B.hasGroupFightIn('CR'), true);
		// the caller's reservation is used by the fight, and freed when it ends
		const fight = await B.runBossFight({ kind: 'group', guildID: G, channelID: 'CR', io: scriptedIO() });
		assert.equal(fight.fighters.size, 0);
		assert.equal(B.hasGroupFightIn('CR'), false, 'freed when the fight ends');
	});

	test('a boss nobody joins leaves', async () => {
		const io = scriptedIO();
		const fight = await B.runBossFight({ kind: 'group', guildID: G, channelID: 'CG2', io });
		assert.equal(fight.fighters.size, 0);
		assert.equal((await BossFight.findByPk(fight.id)).status, 'lost');
		assert.match(io.shown.at(-1).embed.data.description, /Nobody answered the call/);
	});

	test('fights left running by a restart are closed', async () => {
		const row = await BossFight.create({ guildID: G, channelID: 'C', kind: 'group', monsterName: 'X' });
		await B.closeInterruptedFights();
		assert.equal((await row.reload()).status, 'interrupted');
	});
});

describe('random spawns', () => {
	const pending = async (guildID) => (await queue.getJobs(['waiting', 'delayed'])).filter((job) => job.data.guildID === guildID);

	test('turning it on schedules one spawn, changing it replaces it, 0 turns it off', async () => {
		const delay = await B.configureAutoSpawn(queue, G, 'CH', 4);
		assert.ok(delay >= 2 * 3600000 && delay <= 6 * 3600000);
		assert.equal((await pending(G)).length, 1);

		await B.configureAutoSpawn(queue, G, 'CH2', 8);
		assert.equal((await pending(G)).length, 1);
		assert.equal((await BossConfig.findByPk(G)).channelID, 'CH2');

		assert.equal(await B.configureAutoSpawn(queue, G, 'CH2', 0), null);
		assert.equal((await pending(G)).length, 0);
		assert.equal(await BossConfig.findByPk(G), null);
	});

	test('a spawn always schedules the next one, but needs the feature flag to appear', async () => {
		await BossConfig.create({ guildID: 'GFREE', channelID: 'CH', intervalHours: 2 });
		const client = { channels: { fetch: async () => assert.fail('no boss without the flag') } };
		assert.equal(await B.processAutoSpawn(client, queue, { guildID: 'GFREE' }), false);
		assert.equal((await pending('GFREE')).length, 1);

		await B.syncAutoSpawns(queue);
		assert.equal((await pending('GFREE')).length, 1, 'sync doesn\'t double up');
	});

	test('the delay varies around the interval', () => {
		assert.equal(B.autoSpawnDelay(2, () => 0), 3600000);
		assert.equal(B.autoSpawnDelay(2, () => 0.999999), Math.round(2 * 3600000 * 1.499999));
	});
});

describe('/boss', () => {
	const run = async ({ guildId = G, subcommand, mod = false, integers = {} }) => {
		const rec = recorder();
		const interaction = {
			rec,
			guild: { id: guildId },
			user: { id: 'CMD1' },
			channelId: 'CC',
			channel: { id: 'CC' },
			client: { bossQueue: queue },
			memberPermissions: { has: () => mod },
			options: {
				getSubcommand: () => subcommand,
				getInteger: (name) => integers[name] ?? null,
				getString: () => null,
				getChannel: () => null,
			},
			reply: async (p) => rec.push('reply', p),
			editReply: async (p) => rec.push('editReply', p),
			deferReply: async () => rec.push('defer'),
		};
		await bossCommand.execute(interaction);
		return rec.calls.at(-1)[1];
	};

	test('is off unless the server\'s tier has hasBosses', async () => {
		const reply = await run({ guildId: 'GFREE', subcommand: 'challenge' });
		assert.match(reply.embeds[0].data.description, /not available in your current version/);
	});

	test('spawning and autospawn are for moderators', async () => {
		assert.match((await run({ subcommand: 'spawn' })).content, /Moderate Members/);
		assert.match((await run({ subcommand: 'autospawn', integers: { hours: 3 } })).content, /Moderate Members/);
		assert.match((await run({ subcommand: 'autospawn', mod: true, integers: { hours: 3 } })).content, /about every 3 hour/);
		assert.match((await run({ subcommand: 'autospawn', mod: true, integers: { hours: 0 } })).content, /no longer appear/);
	});

	test('a spawn is refused while the channel is taken, even before that fight has started', async () => {
		assert.equal(B.reserveChannel('CC'), true);
		try {
			assert.match((await run({ subcommand: 'spawn', mod: true })).content, /already fighting in this channel/);
		}
		finally {
			B.releaseChannel('CC');
		}
	});

	test('a solo challenge is refused while recovering', async () => {
		await makePlayer('CMD1');
		await redis.set(`boss-solo:${G}:CMD1`, Date.now() + 60000, 'PX', 60000);
		try {
			assert.match((await run({ subcommand: 'challenge' })).content, /still recovering/);
		}
		finally {
			await redis.del(`boss-solo:${G}:CMD1`);
		}
	});
});

describe('quests and factions', () => {
	test('a boss win counts for quests, and a rival boss scores for the fighter\'s faction', async () => {
		const { FactionContribution, QuestProgress } = require('../src/db');
		// mobs[0] belongs to Margaretha, so a Cerberon member fights a rival
		const player = await makePlayer('QF1', { level: 3, totalHealth: 2350, totalAttack: 551, totalDefense: 520, faction: 'Cerberon' });
		const io = scriptedIO({ strategies: { QF1: perfect } });
		const fight = await B.runBossFight({ kind: 'solo', guildID: G, channelID: 'C1', player, io });

		assert.equal(fight.boss.health, 0);
		assert.equal(fight.fighters.get('QF1').rival, true);
		assert.equal(await FactionContribution.sum('points', { where: { accountID: player.accountID, faction: 'Cerberon' } }), 1);
		assert.ok(await QuestProgress.count({ where: { accountID: player.accountID } }) > 0, 'the win reached the quest tracker');
		assert.match(io.shown.at(-1).embed.data.description, /\+1 faction point/);
	});
});
