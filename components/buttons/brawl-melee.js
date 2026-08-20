module.exports = {
	data: {
		name: 'brawl-melee',
	},
	async execute(interaction) {
		await interaction.reply({ content: 'You picked `melee`.', flags: 64 });
	},
};
