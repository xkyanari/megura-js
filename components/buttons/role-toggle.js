const { roleMention } = require('discord.js');
const { REFUSALS, toggleRole } = require('../../functions/rolePanel');

module.exports = {
	data: {
		name: 'role-toggle',
		cooldown: 2000,
	},
	async execute(interaction) {
		const [, panelId, roleId] = interaction.customId.split(':');
		const result = await toggleRole(interaction, Number(panelId), roleId);

		if (!result.ok) {
			const content = result.reason === 'gone'
				? 'This role is no longer on this panel.'
				: `I can't give out this role right now. ${REFUSALS[result.reason]} Please let a server admin know.`;
			return interaction.reply({ content, flags: 64 });
		}

		return interaction.reply({
			content: result.added
				? `You now have the ${roleMention(roleId)} role.`
				: `Removed the ${roleMention(roleId)} role.`,
			flags: 64,
			allowedMentions: { parse: [] },
		});
	},
};
