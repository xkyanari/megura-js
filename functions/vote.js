const { Player } = require('../src/db');

const VOTE_REWARD = 50;

// Credits the vote reward to the user's oldest profile.
const voteWebhook = async (id, votes = 1) => {
	const player = await Player.findOne({
		where: { discordID: id },
		order: [['accountID', 'ASC']],
	});

	if (!player) return;

	await player.addIura(VOTE_REWARD * votes);
};

module.exports = { voteWebhook };
