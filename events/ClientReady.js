const { Events, ActivityType, EmbedBuilder, userMention } = require('discord.js');
const { sequelize, Auction } = require('../src/db');
const { port } = require('../config.json');
const Queue = require('bull');
const app = require('../server');
const { endAuction } = require('../functions/endAuction');

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
					name: '\/start | \/info',
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

		// app.listen(port, () => {
		// 	console.log(`Express server is running on http://localhost:${port}`);
		// });

		const deleteChannelQueue = new Queue('deleteChannel', 'redis://127.0.0.1:6379');
		client.deleteChannelQueue = deleteChannelQueue;

		deleteChannelQueue.process(async (job, done) => {
			const { channelId, guildId, userId, replyChannelId } = job.data;

			const guild = client.guilds.cache.get(guildId);
			const channel = guild.channels.cache.get(channelId);

			if (!guild) {
				console.error('Guild not found');
				return done(new Error('guild not found'));
			}

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
						'Your portal has been closed. Thanks for using our services!\n\nThis message will be deleted in \`10\` seconds.',
					);

				if (replyChannel) {
					const message = await replyChannel.send({ content: `${userMention(userId)}`, embeds: [embed] });

					setTimeout(async () => {
						await message.delete();
					}, 10000);
				}
				done();
			} catch (error) {
				console.error(`Failed to delete channel ${channelId}`);
				done(error);
			}
		});

		const auctionQueue = new Queue('auctionQueue', 'redis://127.0.0.1:6379');
		client.auctionQueue = auctionQueue;

		auctionQueue.process(async (job, done) => {
			const { auctionId } = job.data;

			const auction = await Auction.findByPk(auctionId);

			if (!auction) {
				console.error('Auction not found');
				return done(new Error('Auction not found'));
			}

			try {
				await endAuction(auctionId);
				done();
			} catch (error) {
				console.error(`Failed to end auction ${auctionId}`);
				done(error);
			}
		});
	},
};
