const { ComponentType, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, userMention } = require('discord.js');
const { Brawl } = require('../src/db');
const wait = require('node:timers/promises').setTimeout;

const getWinner = (player1, player1Move, player2, player2Move) => {
	let winner;
	if (player1Move === player2Move || !player2Move || !player2 || !player1 || !player1Move) return null;

	switch (player1Move) {
		case 'brawl-range':
			winner = (player2Move === 'brawl-melee' || player2Move === 'brawl-block') ? player1 : player2;
			break;
		case 'brawl-melee':
			winner = (player2Move === 'brawl-block' || player2Move === 'brawl-dash') ? player1 : player2;
			break;
		case 'brawl-block':
			winner = (player2Move === 'brawl-dash') ? player1 : player2;
			break;
		case 'brawl-dash':
			winner = (player2Move === 'brawl-range') ? player1 : player2;
			break;
		default:
			throw new Error('Invalid move');
	}
	return winner;
};

const simulateBrawl = async (interaction, channel, player1, player2) => {
	let player1Wins = 0;
	let player2Wins = 0;

	try {
		const brawl_channel = interaction.client.channels.cache.get(channel.id);

		const introductionMessage = `# Welcome to the Brawl simulation!\n\n**${userMention(player1)} is challenging ${userMention(player2)} to a fierce battle.**\n\n- The game consists of 5 rounds where you and your opponent will face off in an intense battle.\n- Each round, you will have 30 seconds to select your move.\n- The available moves are Range, Melee, Block, and Dash. Choose wisely to outwit your opponent and emerge victorious!\n- The first player to win 3 rounds will be declared the overall winner.\n\n## Hints for each attack:\n- Long Range: Strong against Short Range and Block, Weak against Dash Attack.\n- Short Range: Strong against Block and Dash Attack, Weak against Long Range.\n- Block: Strong against Dash Attack, Weak against Short Range and Long Range.\n- Dash Attack: Strong against Long Range, Weak against Short Range and Block.\n\nLet the brawl begin!`;

		await brawl_channel.send({ content: introductionMessage });

		let message;
		for (let round = 1; round <= 5; round++) {
			const button = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('brawl-range')
					.setLabel('Range')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('brawl-melee')
					.setLabel('Melee')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('brawl-block')
					.setLabel('Block')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('brawl-dash')
					.setLabel('Dash')
					.setStyle(ButtonStyle.Primary),
			);

			const unixTimestampNow = Math.floor(Date.now() / 1000);
			const unixTimestamp30SecondsLater = unixTimestampNow + 30;

			const countdownMessage = `<t:${unixTimestamp30SecondsLater}:R>`;

			if (!message) {
				const embed0 = new EmbedBuilder()
					.setColor(0xcd7f32)
					.setDescription(`**Round ${round}:**\nSelect your move!\nTimer: ${countdownMessage}`);
				message = await brawl_channel.send({ embeds: [embed0], components: [button] });
			}
			else {
				const embed0 = new EmbedBuilder()
					.setColor(0xcd7f32)
					.setDescription(`**Round ${round}:**\nSelect your move!\nTimer: ${countdownMessage}`);
				await message.edit({ embeds: [embed0], components: [button] });
			}

			await new Promise(resolve => {
				let player1Move = null;
				let player2Move = null;

				const usersClicked = new Set();

				const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

				collector.on('collect', i => {
					if (usersClicked.has(i.user.id)) return;
					usersClicked.add(i.user.id);

					if (i.user.id === player1) {
						player1Move = i.customId;
					}
					if (i.user.id === player2) {
						player2Move = i.customId;
					}
				});

				collector.on('end', collected => {
					let resultMessage;
					let roundWinner;

					if (collected.size === 0) {
						roundWinner = null;
						resultMessage = 'Looks like no one selected a move. Moving on to the next round!';
					}

					if (collected.size === 1) {
						roundWinner = player1Move ? player1 : player2;
						resultMessage = `Only ${userMention(roundWinner)} picked a move so ${userMention(roundWinner)} wins by default!`;
					}

					if (collected.size === 2) {
						roundWinner = getWinner(player1, player1Move, player2, player2Move);
						resultMessage = roundWinner ? `**Round ${round}:** ${userMention(roundWinner)} wins!\n\n${userMention(player1)} - ${player1Wins}\n${userMention(player2)} - ${player2Wins}` : `Round ${round}: It's draw!\n\n${userMention(player1)} - ${player1Wins}\n${userMention(player2)} - ${player2Wins}`;
					}

					if (roundWinner === player1) {
						player1Wins++;
					}
					if (roundWinner === player2) {
						player2Wins++;
					}

					const embed = new EmbedBuilder()
						.setColor(0xcd7f32)
						.setDescription(resultMessage);
					brawl_channel.send({ embeds: [embed] });

					resolve();
				});
			});

			await wait(2000);

			if (player1Wins === 3 || player2Wins === 3) {
				break;
			}

			console.log('Round: ', round);
			console.log('Player 1 Wins: ', player1Wins);
			console.log('Player 2 Wins: ', player2Wins);
		}

		await wait(2000);

		let winner;
		if (player1Wins > player2Wins || player1Wins === 3) {
			winner = player1;
		}
		if (player2Wins > player1Wins || player2Wins === 3) {
			winner = player2;
		}

		if (winner) {
			// send a webhook to the announcement channel
			// mention how much will be transferred to the winner
			await message.delete();
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setDescription(`${userMention(winner)} wins! Congratulations on your victory!`);
			await brawl_channel.send({ embeds: [embed] });
		}
		else {
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setDescription(`The brawl ends in a **draw**. It was an intense battle between ${userMention(player1)} and ${userMention(player2)}!`);
			await brawl_channel.send({ embeds: [embed] });
		}

		// transfer the ores to the winner
		const listingId = brawl_channel.name.split('-')[1];
		await Brawl.findOne({ where: { listingId: listingId } }).then(async (brawl) => {
			brawl.status = 'completed';
			brawl.outcome = winner === player1 ? 'challenger_win' : winner === player2 ? 'acceptor_win' : 'draw';
			await brawl.save();
		});
		setTimeout(async () => {
			brawl_channel.delete().catch(console.error);
		}, 10000);
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = { getWinner, simulateBrawl };