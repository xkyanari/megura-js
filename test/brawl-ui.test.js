require('./config').testMode = false;

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const Queue = require('bull');
const { redisURL } = require('../redis');
const { Player, Guild, Brawl } = require('../src/db');
const modal = require('../components/modals/brawl');
const accept = require('../components/buttons/brawl-accept');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'G1';
const queue = new Queue(`brawlTest${Date.now()}`, redisURL);

const ores = async (id) => (await Player.findOne({ where: { discordID: id, guildID: G } })).oresEarned;

// A modal/button interaction whose channel creation fails, like a bot missing Manage Channels.
const interaction = (userId, extra = {}) => {
	const rec = recorder();
	return {
		rec,
		member: { id: userId, displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png' },
		guild: {
			id: G,
			channels: { create: async () => { throw new Error('Missing Permissions'); } },
		},
		client: { user: { id: 'BOT' }, emojis: { cache: { get: () => null } }, brawlQueue: queue },
		async reply(payload) { rec.push('reply', payload); },
		async fetchReply() { return { id: 'm1', channelId: 'c1' }; },
		...extra,
	};
};

const wagerInput = (value) => ({ fields: { getTextInputValue: () => value } });

before(async () => {
	await resetDb();
	await Guild.create({ guildID: G, walletAmount: 0 });
	await Player.create({ discordID: 'C', guildID: G, oresEarned: 100 });
	await Player.create({ discordID: 'A', guildID: G, oresEarned: 100 });
});

after(async () => {
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

test('the modal rejects wagers that are not whole numbers >= 1', async () => {
	for (const bad of ['abc', '0', '-5', '1.5', '1e3', '']) {
		const i = interaction('C', wagerInput(bad));
		await modal.execute(i);
		assert.match(i.rec.content(0), /valid wager/, `input: "${bad}"`);
	}
});

test('the modal refuses a wager the challenger cannot cover', async () => {
	const i = interaction('C', wagerInput('500'));
	await modal.execute(i);
	assert.match(i.rec.content(0), /not have enough/);
	assert.equal(await Brawl.count(), 0);
});

let listingId;

test('opening a challenge escrows the stake and queues its expiry', async () => {
	const i = interaction('C', wagerInput(' 25 '));
	await modal.execute(i);

	assert.match(i.rec.content(0), /new challenge/);
	listingId = i.rec.calls[0][1].embeds[0].data.footer.text.split(' ')[2];
	assert.equal(await ores('C'), 75);

	const [job] = await queue.getDelayed();
	assert.deepEqual({ ...job.data }, { type: 'expire', listingId, guildID: G, channelId: 'c1', messageId: 'm1' });
	assert.ok(job.opts.delay >= 10 * 60 * 1000 - 1);
});

test('if the brawl channel cannot be created, both stakes are refunded', async () => {
	const message = { embeds: [{ data: { footer: { text: `Listing ID: ${listingId}` } } }] };
	await assert.rejects(accept.execute(interaction('A', { message })), /Missing Permissions/);

	assert.equal(await ores('A'), 100);
	assert.equal(await ores('C'), 100);
	assert.equal((await Guild.findOne({ where: { guildID: G } })).walletAmount, 0);
	assert.equal((await Brawl.findOne({ where: { listingId } })).outcome, 'draw');

	const again = interaction('A', { message });
	await accept.execute(again);
	assert.match(again.rec.content(0), /no longer open/);
});
