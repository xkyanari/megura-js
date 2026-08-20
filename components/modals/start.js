const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');
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
				ephemeral: true,
			});
		}

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});

		if (player && player.playerName) {
			return interaction.reply({
				content: 'You\'re all set!',
				ephemeral: true,
			});
		}

		const createProfile = await Player.create({
			guildID: guild.id,
			discordID: member.id,
			playerName,
			faction: wanderer,
		});

		await createProfile.createIura({
			walletName: await generateId(10),
			bankName: await generateId(10),
		});

		const embed1 = new EmbedBuilder().setDescription(
			'You are now part of the **<REDACTED> system v. 35.0.56**.\n\nYou will be assigned to take part in battles against `Conflicts` surrounding Eldelvain. These are simulation created by an unknown entity in this world named _**Messinia Graciene**_. Origin is also unknown.\nAs they say, for as long as life exists, death and Conflicts follow.',
		);

		const embed2 = new EmbedBuilder().setDescription(
			'I will carry your Voyagers ID so you will be reminded of your identity.\nUse `/profile` for yourself or when you find your friends and enemies.\n\nIf you\'re searching for a Conflict, use `/attack`. There\'s also `/duel` to challenge other voyagers.\n\nI highly recommend that you explore the areas outside Eldelvain or challenge other voyagers using `/open` so you don\'t interfere with other voyagers. Take heed that it closes momentarily.\n\nIf you need to leave early, use the `/close` command. You will be reminded how to use them with care.\n\nLastly, you can use `/info` to see the list of commands to call me.',
		);

		await interaction.reply({
			content: `Thank you, \`${playerName}\`. That's a good name!`,
			embeds: [embed1, embed2],
			ephemeral: true,
		});

		await interaction.followUp({
			content: `For now, you will travel to the \`past\`. Please take care, \`${playerName}\`.`,
			ephemeral: true,
		});
	},
};
