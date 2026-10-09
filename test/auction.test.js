const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Queue = require('bull');
const { Collection } = require('discord.js');
const redis = require('../redis');
const { redisURL } = require('../redis');
const { Guild, Auction, AuctionItem, Bid, User } = require('../src/db');
const messages = require('../functions/auctionMessage');
const bids = require('../functions/placeBid');
const { endAuction, runningAuctions } = require('../functions/endAuction');
const { withdrawBid } = require('../functions/withdrawBid');
const { scheduleAuctionEnd } = require('../functions/startAuction');
const { validateFeature } = require('../src/feature');
const handler = require('../events/InteractionCreate');
const auctionCommand = require('../commands/slash-commands/auction');
const { resetDb, closeAll, recorder } = require('./helpers');

const G = 'GA1';
const queue = new Queue(`auctionTest${Date.now()}`, redisURL);

// record webhook edits instead of calling Discord
const edits = [];
messages.webhookFor = async () => ({ editMessage: async (id, payload) => { edits.push([id, payload]); } });
const balanceOk = true;
bids.checkBalance = async () => balanceOk;

const makeAuction = async ({ guildID = G, hours = 1, price = 1000, messageID } = {}) => {
	const item = await AuctionItem.create({ itemName: 'Rare Item', quantity: 1, description: 'No description provided' });
	return Auction.create({
		userID: 'SELLER', guildID, itemId: item.id, startDateTime: new Date(),
		endDateTime: new Date(Date.now() + hours * 3600 * 1000),
		startPrice: price, currentPrice: price, messageID: messageID ?? `MSG${item.id}`,
	});
};

const bidder = async (id, guildID = G) => {
	const userGuildId = `${id}-${guildID}`;
	await User.create({ discordID: id, guildID, userGuildId, walletAddress: `addr-${id}` });
	return { walletAddress: `addr-${id}`, userGuildId };
};

const clickOn = (auction, userId, guildID = G) => ({
	message: { id: auction.messageID },
	guild: { id: guildID },
	member: { id: userId },
	user: { id: userId },
});

// auctions are off on every tier in features-example.json; these tests still
// cover the (switched-off) code, with Premium and up as before
const exampleFeatures = process.env.FEATURES_FILE;
const featuresFile = path.join(os.tmpdir(), `features-auction-${process.pid}.json`);

before(async () => {
	const features = JSON.parse(fs.readFileSync(exampleFeatures, 'utf8'));
	for (const tier of ['premium', 'enterprise', 'megura']) features[tier].hasAuction = true;
	fs.writeFileSync(featuresFile, JSON.stringify(features));
	process.env.FEATURES_FILE = featuresFile;

	await resetDb();
	await Guild.create({ guildID: G, subscription: 'premium' });
	await Guild.create({ guildID: 'GA2', subscription: 'premium' });
	await Guild.create({ guildID: 'GAFREE', subscription: 'free' });
});
after(async () => {
	process.env.FEATURES_FILE = exampleFeatures;
	fs.rmSync(featuresFile, { force: true });
	await queue.obliterate({ force: true });
	await queue.close();
	await closeAll();
});

describe('bidding and ending', () => {
	test('amounts are stored exactly (BIGINT satoshis)', async () => {
		const auction = await makeAuction({ price: 50000000 });
		await bidder('P0');
		const bid = await bids.placeBid(clickOn(auction, 'P0'), { walletAddress: 'x' }, 328943);
		assert.equal(bid.bidAmount, 50328943);
		assert.equal((await Bid.findByPk(bid.id)).bidAmount, 50328943);
	});

	test('the highest bid wins; ending twice gives the same result', async () => {
		const auction = await makeAuction();
		await bidder('P1');
		await bidder('P2');
		await bids.placeBid(clickOn(auction, 'P1'), {}, 100);
		await bids.placeBid(clickOn(auction, 'P2'), {}, 100);

		const ended = await endAuction(auction.id, G);
		assert.equal(ended.winnerId, `P2-${G}`);
		assert.equal(ended.currentPrice, 1200);
		assert.ok(ended.endDateTime <= new Date());
		const again = await endAuction(auction.id);
		assert.equal(again.winnerId, `P2-${G}`);
	});

	test('no bids after the end, and no withdrawing once it has ended', async () => {
		const auction = await makeAuction();
		await bidder('P3');
		await bids.placeBid(clickOn(auction, 'P3'), {}, 100);
		await endAuction(auction.id);

		await assert.rejects(bids.placeBid(clickOn(auction, 'P3'), {}, 100), /already ended/);
		await assert.rejects(withdrawBid(clickOn(auction, 'P3')), /already ended/);
		assert.equal((await Auction.findByPk(auction.id)).winnerId, `P3-${G}`, 'the winner stays');
	});

	test('a bid racing the end either lands before it or is refused', async () => {
		const auction = await makeAuction();
		await bidder('P4');
		const [bid, ended] = await Promise.allSettled([bids.placeBid(clickOn(auction, 'P4'), {}, 100), endAuction(auction.id)]);
		const final = await Auction.findByPk(auction.id);
		if (bid.status === 'fulfilled') {
			// the end ran after the bid, or a later end will pick it up: either way the winner is consistent
			const recheck = await endAuction(auction.id);
			assert.equal(recheck.winnerId, `P4-${G}`);
		}
		else {
			assert.match(bid.reason.message, /already ended/);
			assert.equal(final.winnerId, null);
		}
		assert.equal(ended.status, 'fulfilled');
	});

	test('bids checked against a price that moved are refused, and insufficient funds too', async () => {
		const auction = await makeAuction();
		await bidder('P5');
		await bidder('P6');
		bids.checkBalance = async () => {
			// someone outbids while the balance is being checked
			await Bid.create({ auctionId: auction.id, userId: `P6-${G}`, bidAmount: 5000, bidDateTime: new Date() });
			return true;
		};
		await assert.rejects(bids.placeBid(clickOn(auction, 'P5'), {}, 100), /price changed/);
		bids.checkBalance = async () => false;
		await assert.rejects(bids.placeBid(clickOn(auction, 'P5'), {}, 100), /Insufficient funds/);
		bids.checkBalance = async () => balanceOk;
	});

	test('withdrawing restores the previous price and needs a bid', async () => {
		const auction = await makeAuction();
		await bidder('P7');
		await bids.placeBid(clickOn(auction, 'P7'), {}, 100);
		const after1 = await withdrawBid(clickOn(auction, 'P7'));
		assert.equal(after1.currentPrice, 1000);
		await assert.rejects(withdrawBid(clickOn(auction, 'P7')), /No bid to withdraw/);
		await assert.rejects(withdrawBid(clickOn({ messageID: 'NOPE' }, 'P7')), /Auction not found/);
	});

	test('bids and withdrawals only see this server\'s auctions', async () => {
		const auction = await makeAuction({ guildID: 'GA2' });
		await assert.rejects(bids.placeBid(clickOn(auction, 'P1', G), {}, 100), /Auction not found/);
		assert.equal(await endAuction(auction.id, G), null);
	});
});

describe('timers and messages', () => {
	test('scheduling is deduplicated and running auctions are found for startup', async () => {
		const auction = await makeAuction({ hours: 2 });
		await scheduleAuctionEnd(queue, auction);
		await scheduleAuctionEnd(queue, auction);
		const jobs = (await queue.getJobs(['delayed'])).filter((j) => j.data.auctionId === auction.id);
		assert.equal(jobs.length, 1);
		assert.ok(jobs[0].opts.removeOnComplete && jobs[0].opts.removeOnFail);
		assert.ok((await runningAuctions()).some((a) => a.id === auction.id));
	});

	test('the closed post shows the winner, and open posts keep Withdraw while bids exist', async () => {
		const auction = await makeAuction();
		await bidder('P8');
		await bids.placeBid(clickOn(auction, 'P8'), {}, 100);
		await messages.refreshOpenAuction(await Auction.findByPk(auction.id));
		const [, open] = edits[edits.length - 1];
		assert.ok(open.components[0].components.some((b) => b.data.custom_id === 'withdrawBid'));

		const ended = await endAuction(auction.id);
		await messages.announceAuctionEnd(ended);
		const [id, closed] = edits[edits.length - 1];
		assert.equal(id, auction.messageID);
		assert.match(closed.content, /CLOSED/);
		assert.ok(closed.embeds[0].data.fields.some((f) => f.name === 'Winner:' && f.value === '<@P8>'));
	});

	test('/auction end: other servers\' IDs are refused; the free tier gets the upgrade message', async () => {
		const other = await makeAuction({ guildID: 'GA2' });
		const run = async (guildId) => {
			await redis.del(`ADMIN:${guildId}:auction`, `counter:ADMIN:${guildId}`);
			const rec = recorder();
			const interaction = {
				rec, deferred: false, replied: false,
				client: { commands: new Collection([['auction', auctionCommand]]), cooldown: new Collection(), auctionQueue: queue },
				commandName: 'auction', user: { id: 'ADMIN' }, member: { id: 'ADMIN' }, guildId, guild: { id: guildId },
				isChatInputCommand: () => true, isUserContextMenuCommand: () => false, isButton: () => false,
				isStringSelectMenu: () => false, isModalSubmit: () => false, isAutocomplete: () => false,
				options: {
					getSubcommand: () => 'end', getInteger: () => other.id,
					getString: () => null, getNumber: () => null, getAttachment: () => null,
				},
				async reply(p) {
					if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
					this.replied = true;
					rec.push('reply', p);
				},
				async deferReply(p) {
					if (this.replied || this.deferred) throw new Error('InteractionAlreadyReplied');
					this.deferred = true;
					rec.push('defer', p);
				},
				async editReply(p) { rec.push('editReply', p); },
				async followUp(p) { rec.push('followUp', p); },
			};
			await handler.execute(interaction);
			return interaction.rec.calls[interaction.rec.calls.length - 1][1];
		};
		assert.match((await run(G)).content, /no auction #\d+ in this server/);
		assert.equal((await Auction.findByPk(other.id)).winnerId, null);
		assert.match((await run('GAFREE')).embeds[0].data.description, /not available in your current version/);
	});

	test('validateFeature edits a deferred reply instead of replying twice', async () => {
		const rec = recorder();
		const interaction = { deferred: true, replied: false, editReply: async (p) => rec.push('editReply', p), reply: async () => { throw new Error('InteractionAlreadyReplied'); } };
		assert.equal(await validateFeature(interaction, 'free', 'hasAuction'), false);
		assert.deepEqual(rec.kinds(), ['editReply']);
	});
});

describe('startup recovery', () => {
	test('overdue auctions that never ended are picked up; finalized ones are not', async () => {
		const overdue = await makeAuction({ hours: -2 });
		const finished = await makeAuction({ hours: -2 });
		await endAuction(finished.id);
		const ancient = await makeAuction({ hours: -24 * 30 });

		const ids = (await runningAuctions()).map((a) => a.id);
		assert.ok(ids.includes(overdue.id), 'overdue and never ended');
		assert.ok(!ids.includes(finished.id), 'already finalized');
		assert.ok(!ids.includes(ancient.id), 'outside the recovery window');
	});
});
