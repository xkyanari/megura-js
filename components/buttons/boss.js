const { ACTIONS, joinFight, recordChoice } = require('../../functions/boss');

const JOIN_REFUSALS = {
	'closed': 'This fight is no longer taking fighters.',
	'joined': 'You have already joined.',
	'full': 'This fight is full.',
	'no profile': 'You need a profile first. Type /start to create one.',
};

const CHOICE_REFUSALS = {
	'closed': 'Too late: that turn is over.',
	'not in fight': 'You are not part of this fight.',
	'knocked out': 'You have been knocked out of this fight.',
	'chosen': 'You have already made your move this turn.',
};

// boss:<fightId>:join, or boss:<fightId>:<turn>:<action> (see functions/boss.js)
module.exports = {
	data: {
		name: 'boss',
	},
	async execute(interaction) {
		const [, fightId, turnOrJoin, action] = interaction.customId.split(':');

		if (turnOrJoin === 'join') {
			const result = await joinFight(fightId, interaction.user.id);
			return interaction.reply({
				content: result.ok ? `⚔️ You joined the fight! ${result.count} fighter(s) so far.` : JOIN_REFUSALS[result.reason],
				flags: 64,
			});
		}

		const result = recordChoice(fightId, turnOrJoin, interaction.user.id, action);
		return interaction.reply({
			content: result.ok ? `${ACTIONS[result.action].emoji} You chose **${ACTIONS[result.action].label}**.` : CHOICE_REFUSALS[result.reason],
			flags: 64,
		});
	},
};
