const { SlashCommandBuilder } = require('discord.js');
const { Player, Iura, Item } = require('../../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reset')
		.setDescription('Remove a voyager profile.')
		.addUserOption((option) =>
			option
				.setName('player')
				.setDescription('Select a player.')
				.setRequired(true),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const member = interaction.options.getUser('player');
		const { guild } = interaction;

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
				include: 'iura',
			});

			if (player) {
				await Promise.all([
					Item.destroy({ where: { accountID: player.iura.accountID } }),
					Iura.destroy({ where: { accountID: player.iura.accountID } }),
					Player.destroy({ where: { discordID: member.id, guildID: guild.id } }),
				]);
				return await interaction.reply({
					content: `\`${member.tag}\` profile has been removed.`,
				});
			}

			await interaction.reply({
				content: `\`${member.tag}\` is not found in the database.`,
			});

		}
		catch (error) {
			console.error(error);
		}
	},
};
