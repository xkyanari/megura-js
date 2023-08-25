module.exports = {
	data: {
		name: 'brawl-range',
	},
	async execute(interaction) {
		await interaction.reply({ content: 'You picked `range`.', ephemeral: true });
	},
};