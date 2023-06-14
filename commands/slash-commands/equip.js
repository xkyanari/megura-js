const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('equip')
		.setDescription('Equip an item.')
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
			const equipped = await player.getItems(true);

			if (!player) {
				throw new Error('profile not found');
			}

			if (!item) {
				return interaction.reply({
					content: 'You don\'t own that item.',
					ephemeral: true,
				});
			}

			if (equipped.length >= 5) {
				return interaction.reply({
					content: 'You can equip up to 5 different items only.',
					ephemeral: true,
				});
			}

			if (player.level < item.level) {
				return interaction.reply({
					content: 'Your level is too low to equip this item.',
					ephemeral: true,
				});
			}

			if (item.equippedAmount === amount) {
				return interaction.reply({
					content: `You already have all \`${item.itemName}\` equipped.`,
					ephemeral: true,
				});
			}

			if (item.quantity < amount) {
				return interaction.reply({
					content: `You do not have enough \`${item.itemName}\` to equip.`,
					ephemeral: true,
				});
			}

			await player.updateStats(item.itemName, true, amount);
			await player.updateItem(id, true);

			await interaction.reply({ content: `You equipped \`${item.itemName}\`.`, ephemeral: true });
		}
		catch (error) {
			console.error(error);
		}
	},
};
