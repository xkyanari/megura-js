const { EmbedBuilder } = require('discord.js');
const { Guild } = require('../src/db');

module.exports = async (interaction) => {
	try {
		const guildCheck = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});

		if (!guildCheck.margarethaID || !guildCheck.cerberonID) {
			return interaction.reply({
				content: 'Please assign roles for Margaretha and/or Cerberon first.',
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder()
			.setTitle('Choose your Faction')
			.setDescription(
				`Please choose which faction resonates with your principles the most:
					
					➡️ **${guildCheck.cerberonName}**
					${guildCheck.cerberonName} follows __logic__. Members of this faction think that solving problems would help remove the pain and despair. They are willing to take risks to achieve what they want. They deal with life based from the past.
					
					➡️ **${guildCheck.margarethaName}**
					${guildCheck.margarethaName} follows __emotion__. Members of this faction have compassion towards everything. They think moving forward is the best way to get over with grief. They deal with life for the future.
					`,
			);

		await interaction.reply({
			embeds: [embed],
			components: [
				{
					type: 1,
					components: [
						{
							type: 2,
							custom_id: 'cerberon',
							label: `${guildCheck.cerberonName}`,
							style: 1,
						},
						{
							type: 2,
							custom_id: 'margaretha',
							label: `${guildCheck.cerberonName}`,
							style: 1,
						},
					],
				},
			],
		});
	}
	catch (error) {
		console.error(error);
	}
};
