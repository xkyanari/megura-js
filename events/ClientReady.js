const { Events, ActivityType } = require('discord.js');
const { sequelize } = require('../src/db');
// const { port } = require('../config.json');
const Queue = require('bull');
const { startVoteServer } = require('../server');
const { redisURL } = require('../redis');
const { cleanupOldLogs } = require('../functions/logs');
const { processBrawlJob } = require('../functions/brawlWager');
const { processTicketJob } = require('../functions/ticket');
const { startHeartbeat } = require('../functions/health');

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

		// Deleting closed ticket channels (see functions/ticket.js)
		const ticketQueue = new Queue('ticketQueue', redisURL);
		client.ticketQueue = ticketQueue;
		ticketQueue.process((job) => processTicketJob(client, job.data));

		// last: the container only reports healthy once everything above has started
		startHeartbeat(client);
	},
};
