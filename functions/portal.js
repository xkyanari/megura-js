const { EmbedBuilder, userMention } = require('discord.js');

/**
 * Portals (/open and /close): temporary private channels, deleted by a
 * delayed job on client.deleteChannelQueue (see events/ClientReady.js).
 */

// One portal per member per server: the job ID makes a second one impossible, even at the same time.
const portalJobId = (guildId, userId) => `portal-${guildId}-${userId}`;

const portalJobOptions = (guildId, userId, delay) => ({
	jobId: portalJobId(guildId, userId),
	delay,
	attempts: 3,
	removeOnComplete: true,
	removeOnFail: true,
});

const findPortalJob = async (queue, guildId, userId) => {
	const jobs = await queue.getJobs(['waiting', 'delayed']);
	return jobs.find((job) => job.data.userId === userId && job.data.guildId === guildId) ?? null;
};

// Deletes a portal when its time is up (or after /close). Returns false if it was already gone.
const processPortalJob = async (client, { channelId, userId, replyChannelId }) => {
	const channel = await client.channels.fetch(channelId).catch(() => null);
	// deleted by hand already: nothing left to do, so don't retry
	if (!channel) return false;

	await channel.delete();

	const replyChannel = replyChannelId && await client.channels.fetch(replyChannelId).catch(() => null);
	if (replyChannel) {
		const embed = new EmbedBuilder()
			.setColor(0x6e8b3d)
			.setTitle('Times Up!')
			.setDescription('Your portal has been closed. Thanks for using our services!\n\nThis message will be deleted in `10` seconds.');
		// the portal is gone either way, so a failed notice mustn't retry the job
		const message = await replyChannel.send({ content: userMention(userId), embeds: [embed] }).catch(() => null);
		if (message) setTimeout(() => message.delete().catch(() => null), 10000);
	}
	return true;
};

module.exports = { portalJobId, portalJobOptions, findPortalJob, processPortalJob };
