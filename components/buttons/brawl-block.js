module.exports = {
	data: {
		name: 'brawl-block',
	},
	async execute(interaction) {
		await interaction.reply({ content: 'You picked `block`.', ephemeral: true });
	},
};
