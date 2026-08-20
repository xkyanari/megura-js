const {
	SlashCommandBuilder,
	EmbedBuilder,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('close')
		.setDescription('Closes a portal'),
	cooldown: 13000,
	async execute(interaction) {
		const { guild, client, member } = interaction;

		try {
			await interaction.deferReply({ flags: 64 });
			const jobs = await client.deleteChannelQueue.getJobs(['waiting', 'delayed']);
			const job = jobs.find(job1 => job1.data.userId === member.id);

			if (!job) return await interaction.editReply({ content: 'You do not have an active portal.', flags: 64 });

			const channelId = job.data.channelId;
			const channel = guild.channels.cache.get(channelId);

			if (!channel) return await interaction.editReply({ content: 'Looks like your portal vanished into thin air. Oh well...', flags: 64 });

			const time = 10;
			const embed = new EmbedBuilder()
				.setColor(0x6e8b3d)
				.setTitle('Consider it done.')
				.setDescription(
					`The channel will be deleted in \`${time}\` seconds.`,
				);

			await interaction.editReply({ embeds: [embed], flags: 64 });

			setTimeout(async () => {
				channel.delete().catch(console.error);
				await job.remove();
			}, time * 1000);
		}
		catch (error) {
			console.error(error);
		}
	},
};
