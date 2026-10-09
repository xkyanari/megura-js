const { SlashCommandBuilder } = require('discord.js');
const { sequelize, Player, Iura, Item } = require('../../src/db');

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

		// every profile this member has here (older bugs could create two)
		const players = await Player.findAll({ where: { discordID: member.id, guildID: guild.id } });

		if (players.length) {
			const accountID = players.map((player) => player.accountID);
			await sequelize.transaction(async (transaction) => {
				await Item.destroy({ where: { accountID }, transaction });
				await Iura.destroy({ where: { accountID }, transaction });
				await Player.destroy({ where: { accountID }, transaction });
			});
			return await interaction.reply({
				content: `\`${member.tag}\` profile has been removed.`,
			});
		}

		await interaction.reply({
			content: `\`${member.tag}\` is not found in the database.`,
		});
	},
};
