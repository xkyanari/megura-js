const { findForm, formFields, buildModal } = require('../../functions/form');

// Opens the form's pop-up; components/modals/form-submit.js handles the answers.
module.exports = {
	data: {
		name: 'form-open',
	},
	async execute(interaction) {
		const [, id] = interaction.customId.split(':');
		const form = await findForm(Number(id), interaction.guild.id);
		const fields = form ? await formFields(form.id) : [];
		if (!fields.length) {
			return interaction.reply({ content: 'This form is no longer available.', flags: 64 });
		}
		return interaction.showModal(buildModal(form, fields));
	},
};
