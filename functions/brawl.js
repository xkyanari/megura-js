const { ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const getWinner = (player1, player2) => {
	let winner;
	if (player1.move === player2.move) return null;

	switch (player1.move) {
		case 'range':
			winner = (player2.move === 'melee' || player2.move === 'block') ? player1 : player2;
			break;
		case 'melee':
			winner = (player2.move === 'block' || player2.move === 'dash') ? player1 : player2;
			break;
		case 'block':
			winner = (player2.move === 'dash') ? player1 : player2;
			break;
		case 'dash':
			winner = (player2.move === 'range') ? player1 : player2;
			break;
		default:
			throw new Error('Invalid move');
	}
	return winner;
};

const simulateBrawl = async (interaction, player1, player2) => {
	// send a message per round to allow users to pick an attack or defense
	let player1Wins = 0;
	let player2Wins = 0;

	for (let round = 1; round <= 10; round++) {
		const button = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setLabel('Range')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setLabel('Melee')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setLabel('Block')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setLabel('Dash')
				.setStyle(ButtonStyle.Primary),
		);
		await interaction.reply({ content: `Round ${round}:\nSelect your move!`, components: [button] });

		const collector = interaction.createMessageComponentCollector({ componentType: ComponentType.Button, time: 10000 }); // change to 60000
		collector.on('collect', i => {
			if (i.user.id === player1.id) {
				i.reply({ content: `${player1.name} picked a move!` });
			}
			if (i.user.id === player2.id) {
				i.reply({ content: `${player2.name} picked a move!` });
			}
		});

		collector.on('end', collected => {
			// determine the winner of the round based on the moves
			const roundWinner = getWinner(player1, player2);

			if (roundWinner === player1) {
				player1Wins++;
			}
			if (roundWinner === player2) {
				player2Wins++;
			}

			// check if either player has won the best of 5 rounds
			if (player1Wins === 5) {
				return interaction.editReply({ content: 'Player 1 wins!' });
			}
			if (player2Wins === 5) {
				return interaction.editReply({ content: 'Player 2 wins!' });
			}
		});
	}
};

module.exports = { getWinner, simulateBrawl };