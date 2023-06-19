const {
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('close')
		.setDescription('Closes a portal'),
	cooldown: 13000,
	async execute(interaction) {
		const { guild, client, member } = interaction;

		try {
			await interaction.deferReply({ ephemeral: true });
			const jobs = await client.deleteChannelQueue.getJobs(['waiting', 'delayed']);
			const job = jobs.find(job => job.data.userId === member.id);

			if (!job) return await interaction.reply({ content: 'You do not have an active portal.', ephemeral: true });

			const channelId = job.data.channelId;
			const channel = guild.channels.cache.get(channelId);

			if (!channel) return await interaction.reply({ content: 'Looks like your portal vanished into thin air. Oh well...', ephemeral: true });

			const time = 10;
			const embed = new EmbedBuilder()
				.setColor(0x6e8b3d)
				.setTitle('Consider it done.')
				.setDescription(
					`The channel will be deleted in \`${time}\` seconds.`,
				);

			const message = await interaction.reply({ embeds: [embed], ephemeral: true });

			setTimeout(async () => {
				channel.delete().catch(console.error);
				await job.remove();
				await message.delete();
			}, time * 1000);
		}
		catch (error) {
			console.error(error);
		}
	},
};
