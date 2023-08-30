module.exports = {
	data: {
		name: 'brawl-dash',
	},
	async execute(interaction) {
		await interaction.reply({ content: 'You picked `dash`.', ephemeral: true });
	},
};
