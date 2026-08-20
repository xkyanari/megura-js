const { Player } = require('../../src/db');
const { checkProfile } = require('../../src/vars');

const VALID_PLAYER_NAME = /^[a-zA-Z0-9 ]{1,20}$/;

module.exports = {
	data: {
		name: 'changenick',
	},
	async execute(interaction) {
		const { member, guild } = interaction;
		const playerName = interaction.fields.getTextInputValue('playerName').trim();

		if (!VALID_PLAYER_NAME.test(playerName)) {
			return interaction.reply({
				content: 'Please use up to 20 letters, numbers, and spaces for your character name.',
				ephemeral: true,
			});
		}

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});

		if (!player) {
			return interaction.reply({
				content: checkProfile,
				ephemeral: true,
			});
		}

		await Player.update(
			{ playerName },
			{
				where: {
					guildID: guild.id,
					discordID: member.id,
				},
			},
		);

		await interaction.reply({
			content: `Thank you, \`${playerName}\`. I like your old name though.`,
			ephemeral: true,
		});
	},
};
