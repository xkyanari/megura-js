const { toggleEntry } = require('../../functions/giveaway');

module.exports = {
	data: {
		name: 'giveaway-enter',
	},
	async execute(interaction) {
		const [, id] = interaction.customId.split(':');
		const result = await toggleEntry(Number(id), interaction.user.id);

		if (!result.ok) {
			return interaction.reply({ content: 'This giveaway has ended.', flags: 64 });
		}

		const entries = `${result.count} ${result.count === 1 ? 'entry' : 'entries'} so far.`;
		return interaction.reply({
			content: result.entered
				? `🎉 You're in! ${entries} Click again to leave.`
				: `You've left the giveaway. ${entries}`,
			flags: 64,
		});
	},
};
