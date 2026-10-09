const { Events, ActivityType } = require('discord.js');
const { sequelize } = require('../src/db');
// const { port } = require('../config.json');
const Queue = require('bull');
const { startVoteServer } = require('../server');
const { endAuction, runningAuctions } = require('../functions/endAuction');
const { scheduleAuctionEnd } = require('../functions/startAuction');
const { announceAuctionEnd } = require('../functions/auctionMessage');
const { redisURL } = require('../redis');
const { cleanupOldLogs } = require('../functions/logs');
const { processBrawlJob } = require('../functions/brawlWager');
const { processGiveawayJob } = require('../functions/giveaway');
const { processRaffleJob } = require('../functions/raffle');
const { processTicketJob } = require('../functions/ticket');
const { processPortalJob } = require('../functions/portal');
const { processScheduledPost, syncScheduledPosts } = require('../functions/schedule');
const { processAutoSpawn, syncAutoSpawns, closeInterruptedFights } = require('../functions/boss');
const { Giveaway, Raffle } = require('../src/db');

let Discord;
try {
	Discord = require('discord.js');
}
catch (e) {
	console.log(e.stack);
	console.log(process.version);
	console.log('Please run npm install and ensure it passes with no errors!');
	process.exit();
}

/**
 * This event is fired once the bot is connected.
 */

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		client.user.setPresence({
			activities: [
				{
					name: '/start | /info',
					type: ActivityType.Listening,
				},
			],
			status: 'dnd',
		});
		console.log(
			`You're now connected as ${client.user.tag}.\nNode version: ${process.version}\nDiscord.js version: ${Discord.version}`,
		);

		const sync = {
			default: {},
			alter: {
				alter: true,
			},
			force: {
				force: true,
			},
		};

		try {
			await sequelize.sync(sync.default);
		}
		catch (error) {
			// without the database nothing works: exit so Docker (or pm2) restarts the bot
			console.error('Could not connect to the database:', error);
			process.exit(1);
		}
		console.log('Database connection successful.');
		startVoteServer();
		await cleanupOldLogs();
		setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);


		const deleteChannelQueue = new Queue('deleteChannel', redisURL);
		client.deleteChannelQueue = deleteChannelQueue;

		deleteChannelQueue.process((job) => processPortalJob(client, job.data));

		// Brawl expiry and settle timeouts (see functions/brawlWager.js)
		const brawlQueue = new Queue('brawlQueue', redisURL);
		client.brawlQueue = brawlQueue;

		brawlQueue.process(async (job) => {
			const expired = await processBrawlJob(job.data);
			const { channelId, messageId } = job.data;

			// remove the listing that nobody accepted
			if (expired && channelId && messageId) {
				const channel = await client.channels.fetch(channelId).catch(() => null);
				await channel?.messages.delete(messageId).catch((err) => {
					if (err.code !== 10008) console.error('Failed to delete brawl listing:', err);
				});
			}
		});

		// Giveaway endings (see functions/giveaway.js)
		const giveawayQueue = new Queue('giveawayQueue', redisURL);
		client.giveawayQueue = giveawayQueue;
		giveawayQueue.process((job) => processGiveawayJob(client, job.data));

		// Make sure every running giveaway has its end scheduled, e.g. if adding
		// the job failed when it started. Bull ignores a jobId it already has.
		const running = await Giveaway.findAll({ where: { status: 'running' } });
		for (const giveaway of running) {
			await giveawayQueue.add(
				{ giveawayId: giveaway.id },
				{ jobId: `giveaway-${giveaway.id}`, delay: Math.max(0, giveaway.endsAt - Date.now()), removeOnComplete: true },
			).catch((error) => console.error(`Could not schedule giveaway ${giveaway.id}:`, error));
		}

		// Raffle endings (see functions/raffle.js), re-scheduled at startup like giveaways
		const raffleQueue = new Queue('raffleQueue', redisURL);
		client.raffleQueue = raffleQueue;
		raffleQueue.process((job) => processRaffleJob(client, job.data));

		const runningRaffles = await Raffle.findAll({ where: { status: 'running' } });
		for (const raffle of runningRaffles) {
			await raffleQueue.add(
				{ raffleId: raffle.id },
				{ jobId: `raffle-${raffle.id}`, delay: Math.max(0, raffle.endsAt - Date.now()), removeOnComplete: true },
			).catch((error) => console.error(`Could not schedule raffle ${raffle.id}:`, error));
		}

		// Deleting closed ticket channels (see functions/ticket.js)
		const ticketQueue = new Queue('ticketQueue', redisURL);
		client.ticketQueue = ticketQueue;
		ticketQueue.process((job) => processTicketJob(client, job.data));

		// Scheduled posts (see functions/schedule.js): repeatable jobs, matched
		// to the ScheduledPost table at every start
		const scheduleQueue = new Queue('scheduleQueue', redisURL);
		client.scheduleQueue = scheduleQueue;
		scheduleQueue.process((job) => processScheduledPost(client, scheduleQueue, job.data));
		await syncScheduledPosts(scheduleQueue).catch((error) => console.error('Could not sync scheduled posts:', error));

		// Boss fights (see functions/boss.js): fights cut off by a restart are closed,
		// and every server with random spawns gets its next one scheduled
		await closeInterruptedFights().catch((error) => console.error('Could not close interrupted boss fights:', error));
		const bossQueue = new Queue('bossQueue', redisURL);
		client.bossQueue = bossQueue;
		bossQueue.process((job) => processAutoSpawn(client, bossQueue, job.data));
		await syncAutoSpawns(bossQueue).catch((error) => console.error('Could not sync boss spawns:', error));

		const auctionQueue = new Queue('auctionQueue', redisURL);
		client.auctionQueue = auctionQueue;

		// a plain async processor: a thrown error fails the job, so it is retried
		auctionQueue.process(async (job) => {
			const auction = await endAuction(job.data.auctionId);
			if (!auction) return false;
			await announceAuctionEnd(auction);
			return true;
		});

		// make sure every running auction has its end scheduled
		for (const auction of await runningAuctions()) {
			await scheduleAuctionEnd(auctionQueue, auction)
				.catch((error) => console.error(`Could not schedule auction ${auction.id}:`, error));
		}
	},
};
