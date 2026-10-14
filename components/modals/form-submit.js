const { submitForm } = require('../../functions/form');

const REFUSALS = {
	'gone': 'This form is no longer available.',
	'no channel': 'I couldn\'t deliver your answers: the form\'s response channel no longer exists. Please let a server admin know.',
};

module.exports = {
	data: {
		name: 'form-submit',
		cooldown: 10000,
	},
	async execute(interaction) {
		const [, id] = interaction.customId.split(':');
		const result = await submitForm(interaction, Number(id));
		if (!result.ok) {
			return interaction.reply({ content: REFUSALS[result.reason], flags: 64 });
		}
		return interaction.reply({ content: `✅ Thanks! Your answers to **${result.form.title}** were sent.`, flags: 64 });
	},
};
