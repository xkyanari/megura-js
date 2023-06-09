const { Guild } = require('../../src/db');

module.exports = {
	data: {
		name: 'button',
	},
	async execute(interaction) {
		const guild = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});
		const verified = interaction.guild.roles.cache.get(guild.verifyRoleID);

		if (
			interaction.member.roles.cache.some((role) => role.name === verified.name)
		) {
			return interaction.reply({ content: 'You\'re all set!', ephemeral: true });
		}
		else {
			await interaction.member.roles.add(verified);
			await interaction.reply({ content: 'Verified!', ephemeral: true });
		}
	},
};
