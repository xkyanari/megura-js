const { Events, ActivityType, EmbedBuilder, userMention, WebhookClient } = require('discord.js');
const { sequelize, Auction, Guild } = require('../src/db');
// const { port } = require('../config.json');
const Queue = require('bull');
// const app = require('../server');
const { endAuction } = require('../functions/endAuction');
const { dahliaName, dahliaAvatar } = require('../src/vars');
const { redisURL } = require('../redis');
const { cleanupOldLogs } = require('../functions/logs');
const { processBrawlJob } = require('../functions/brawlWager');
const { processGiveawayJob } = require('../functions/giveaway');
const { processRaffleJob } = require('../functions/raffle');
const { processTicketJob } = require('../functions/ticket');
const { processScheduledPost, syncScheduledPosts } = require('../functions/schedule');
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

		await sequelize.sync(sync.default);
		console.log('Database connection successful.');
		await cleanupOldLogs();
		setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

		// app.listen(port, () => {
		// 	console.log(`Express server is running on http://localhost:${port}`);
		// });

		const deleteChannelQueue = new Queue('deleteChannel', redisURL);
		client.deleteChannelQueue = deleteChannelQueue;

		deleteChannelQueue.process(async (job, done) => {
			const { channelId, guildId, userId, replyChannelId } = job.data;

			const guild = client.guilds.cache.get(guildId);

			if (!guild) {
				console.error('Guild not found');
				return done(new Error('guild not found'));
			}

			const channel = guild.channels.cache.get(channelId);

			if (!channel) {
				console.error('Channel not found');
				return done(new Error('Channel not found'));
			}

			try {
				await channel.delete();
				console.log(`Deleted channel ${channelId}`);
				const replyChannel = guild.channels.cache.get(replyChannelId);

				const embed = new EmbedBuilder()
					.setColor(0x6e8b3d)
					.setTitle('Times Up!')
					.setDescription(
						'Your portal has been closed. Thanks for using our services!\n\nThis message will be deleted in `10` seconds.',
					);

				if (replyChannel) {
					const message = await replyChannel.send({ content: `${userMention(userId)}`, embeds: [embed] });

					setTimeout(async () => {
						await message.delete();
					}, 10000);
				}
				done();
			}
			catch (error) {
				console.error(`Failed to delete channel ${channelId}`);
				done(error);
			}
		});

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

		const auctionQueue = new Queue('auctionQueue', redisURL);
		client.auctionQueue = auctionQueue;

		auctionQueue.process(async (job, done) => {
			const { auctionId, guildId } = job.data;

			const auction = await Auction.findByPk(auctionId);

			if (!auction) {
				console.error('Auction not found');
				return done(new Error('Auction not found'));
			}

			try {
				await endAuction(auctionId);

				// Fetch auction item
				const item = await auction.getAuctionItem();

				// Get auction webhook details
				const { auctionwebhookId, auctionwebhookToken } = await Guild.findOne({ where: { guildId: guildId } });

				// Initiate the webhook client
				const webhookClient = new WebhookClient({ id: auctionwebhookId, token: auctionwebhookToken });

				// Create a new embed message
				const newEmbed = new EmbedBuilder()
					.setTitle(`Auction: ${item.itemName}`)
					.setColor(0xcd7f32)
					.addFields(
						{ name: 'Quantity:', value: `${item.quantity}`, inline: true },
						{ name: 'Starting Price:', value: `${auction.startPrice / 100000000}🪙`, inline: true },
						{ name: 'Highest Bid:', value: `${auction.currentPrice / 100000000}🪙`, inline: true },
						{ name: 'Auctioneer:', value: `${userMention(auction.userID)}`, inline: true },
					)
					.setFooter({ text: `Auction ID: ${auction.id}` });

				// Add auction image
				if (auction.attachmentURL) {
					newEmbed.setImage(auction.attachmentURL);
				}

				// Add item description
				if (item.description !== 'No description provided') {
					newEmbed.setDescription(item.description);
				}

				// Add auction winner
				if (auction.winnerId) {
					const discordID = auction.winnerId.split('-');
					const winningID = discordID[0];
					newEmbed.addFields(
						{ name: 'Winner:', value: `${userMention(winningID)}`, inline: true },
					);
				}

				// Update the message
				await webhookClient.editMessage(auction.messageID, {
					content: '**The Auction is now CLOSED!**',
					username: dahliaName,
					avatarURL: dahliaAvatar,
					embeds: [newEmbed],
					components: [],
				});

				done();
			}
			catch (error) {
				console.error(`Failed to end auction ${auctionId}`);
				done(error);
			}
		});
	},
};
