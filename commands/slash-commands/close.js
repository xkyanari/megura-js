const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { portalJobOptions, findPortalJob } = require('../../functions/portal');

// Seconds between /close and the portal being deleted.
const CLOSE_SECONDS = 10;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('close')
		.setDescription('Closes a portal'),
	cooldown: 13000,
	async execute(interaction) {
		const { guild, client, member } = interaction;
		const queue = client.deleteChannelQueue;

		await interaction.deferReply({ flags: 64 });
		const job = await findPortalJob(queue, guild.id, member.id);
		if (!job) return interaction.editReply('You do not have an active portal.');

		const channel = await client.channels.fetch(job.data.channelId).catch(() => null);
		if (!channel) {
			// deleted by hand: free the member up to open a new one
			await job.remove().catch(() => null);
			return interaction.editReply('Looks like your portal vanished into thin air. Oh well...');
		}

		// swap the 15-minute job for a 10-second one, so it closes even if the bot restarts
		await job.remove();
		await queue.add(job.data, portalJobOptions(guild.id, member.id, CLOSE_SECONDS * 1000));

		const embed = new EmbedBuilder()
			.setColor(0x6e8b3d)
			.setTitle('Consider it done.')
			.setDescription(`The channel will be deleted in \`${CLOSE_SECONDS}\` seconds.`);
		await interaction.editReply({ embeds: [embed] });
	},
};
