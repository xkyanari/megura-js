const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const redis = require('../../redis');
const { wanderer } = require('../../src/vars');
const { generateId } = require('../../functions/generateId');

const VALID_PLAYER_NAME = /^[a-zA-Z0-9 ]{1,20}$/;

module.exports = {
	data: {
		name: 'start',
	},
	async execute(interaction) {
		const { member, guild } = interaction;
		const playerName = interaction.fields.getTextInputValue('playerName').trim();

		if (!VALID_PLAYER_NAME.test(playerName)) {
			return interaction.reply({
				content: 'Please use up to 20 letters, numbers, and spaces for your character name.',
				flags: 64,
			});
		}

		// two /start pop-ups submitted together must not create two profiles
		const lockKey = `start:${guild.id}:${member.id}`;
		if (!await redis.set(lockKey, '1', 'PX', 10000, 'NX')) {
			return interaction.reply({ content: 'Your profile is being created. Please wait a moment.', flags: 64 });
		}

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
				include: 'iura',
			});

			if (player?.playerName) {
				return interaction.reply({
					content: 'You\'re all set!',
					flags: 64,
				});
			}

			const profile = player
				? await player.update({ playerName })
				: await Player.create({
					guildID: guild.id,
					discordID: member.id,
					playerName,
					faction: wanderer,
				});

			if (!player?.iura) {
				await profile.createIura({
					walletName: await generateId(10),
					bankName: await generateId(10),
				});
			}
		}
		finally {
			await redis.del(lockKey);
		}

		const embed1 = new EmbedBuilder().setDescription(
			'You are now part of the **<REDACTED> system v. 35.0.56**.\n\nYou will be assigned to take part in battles against `Conflicts` surrounding Eldelvain. These are simulation created by an unknown entity in this world named _**Messinia Graciene**_. Origin is also unknown.\nAs they say, for as long as life exists, death and Conflicts follow.',
		);

		const embed2 = new EmbedBuilder().setDescription(
			'I will carry your Voyagers ID so you will be reminded of your identity.\nUse `/profile view` for yourself or when you find your friends and enemies.\n\nIf you\'re searching for a Conflict, use `/attack`. There\'s also `/duel` to challenge other voyagers.\n\nI highly recommend that you explore the areas outside Eldelvain or challenge other voyagers using `/open` so you don\'t interfere with other voyagers. Take heed that it closes momentarily.\n\nIf you need to leave early, use the `/close` command. You will be reminded how to use them with care.\n\nLastly, you can use `/info` to see the list of commands to call me.',
		);

		await interaction.reply({
			content: `Thank you, \`${playerName}\`. That's a good name!`,
			embeds: [embed1, embed2],
			flags: 64,
		});

		await interaction.followUp({
			content: `For now, you will travel to the \`past\`. Please take care, \`${playerName}\`.`,
			flags: 64,
		});
	},
};
