const { deleteProfile } = require('../../functions/deleteProfile');

const messages = {
	confirmation: 'Nothing was deleted. Type your exact character name and DELETE to confirm.',
	missing: 'That character no longer exists. No other character was deleted.',
	pending: 'Nothing was deleted. Finish pending brawls, boss fights in this server and special-shop orders before starting over.',
};

module.exports = {
	data: { name: 'profile-delete' },
	async execute(interaction) {
		if (!interaction.guild) return interaction.reply({ content: 'Please use this command in a server.', flags: 64 });
		await interaction.deferReply({ flags: 64 });
		const result = await deleteProfile({
			accountID: Number(interaction.customId.split(':')[1]),
			discordID: interaction.user.id,
			guildID: interaction.guild.id,
			characterName: interaction.fields.getTextInputValue('characterName'),
			confirmation: interaction.fields.getTextInputValue('confirmation'),
		});
		return interaction.editReply({
			content: result.ok
				? 'Your voyager and their gear, balances and progress have been permanently deleted in this server. Use /start to create a new character.'
				: messages[result.reason],
		});
	},
};
