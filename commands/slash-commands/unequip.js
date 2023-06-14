const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unequip')
		.setDescription('Unequip an item.')
		.addStringOption((option) =>
			option.setName('id').setDescription('Enter item ID.').setRequired(true),
		)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription('Enter amount.').setRequired(true),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;
		const id = options.getString('id');
		const amount = options.getInteger('amount');

		try {
			const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });

			const item = await player.getItem(id);

			if (!player) {
				throw new Error('profile not found');
			}

			if (!item) {
				return interaction.reply({
					content: 'You don\'t own that item.',
					ephemeral: true,
				});
			}

			if (!item.equippedAmount === 0) {
				return interaction.reply({
					content: `You already have \`${item.itemName}\` unequipped.`,
					ephemeral: true,
				});
			}

			await player.updateStats(item.itemName, false, amount);
			await player.updateItem(id, false);

			await interaction.reply(`You unequipped \`${item.itemName}\`.`);
		}
		catch (error) {
			console.error(error);
		}
	},
};
