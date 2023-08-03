const Discord = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const logger = require('../../src/logger');
const { checkProfile } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('changenick')
		.setDescription('Update your profile'),
	cooldown: 3000,
	async execute(interaction) {
		const { channel, member, guild } = interaction;
		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});

		logger.log({
			level: 'info',
			message: `User: ${member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		if (!player) {
			return interaction.reply({
				content: checkProfile,
				ephemeral: true,
			});
		}

		const nick = player.playerName;
		await interaction
			.reply(
				`You want to change your name from \`${nick}\`? Okay. What should I call you?\nYou have 3 attempts.`,
			)
			.catch(console.error);

		let attempt = 0;
		try {
			do {
				const filter = (m) => m.author.id === member.id;
				const collected = await channel.awaitMessages({
					filter,
					max: 1,
					time: 120_000,
					errors: ['time'],
				});
				const player_name = collected.first();

				if (player_name.content.length <= 20) {
					await channel.send(`\`${player_name.content}\`, right? Y/N`);
					const message = await channel.awaitMessages({
						filter,
						max: 1,
						time: 120_000,
						errors: ['time'],
					});
					const confirm = message.first();
					if (confirm.content === 'Y' || confirm.content === 'y') {
						await channel.send(
							`Thank you \`${player_name.content}\`. I like your old name though.`,
						);
						await Player.update(
							{ playerName: player_name.content },
							{
								where: {
									guildID: guild.id,
									discordID: member.id,
								},
							},
						).then(() => console.log('Player update successful!'));
						break;
					}
					else if (
						confirm.content === 'N' ||
						(confirm.content === 'n' && attempt < 2)
					) {
						const left = 2 - attempt;
						await channel.send(
							`Alright. What should I call you?\nYou have ${left} attempt/s left.`,
						);
					}
					else {
						await channel.send(
							'Sorry, I did not get that. Please come back when you\'re ready.',
						);
						break;
					}
				}
				else {
					await channel.send('Your name is too long. What should I call you?');
				}
				attempt++;
				if (attempt == 3) {
					await channel.send(
						'You\'ve reached the maximum attempts. Just run the command again when you make up your mind.',
					);
				}
			} while (attempt < 3);
		}
		catch (error) {
			if (error instanceof Discord.Collection) {
				await channel.send(
					'Do you need more time? That\'s okay. Just run the command again when you\'re ready.',
				);
			}
			else {
				console.log(error);
			}
		}
	},
};
