const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const logger = require('../../src/logger');
const { checkProfile } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('equip')
		.setDescription('Equip an item.')
		.addStringOption((option) =>
			option.setName('id').setDescription('Enter item ID.').setRequired(true),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;
		const id = interaction.options.getString('id');

		logger.log({
			level: 'info',
			message: `User: ${member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		try {
			const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });

			const item = await player.getItem(id);
			const equipped = await player.getItems(true);

			if (!player) {
				return interaction.reply({
					content: checkProfile,
					ephemeral: true,
				});
			}

			if (!item) {
				return interaction.reply({
					content: 'You don\'t own that item.',
					ephemeral: true,
				});
			}

			if (equipped.length >= 5) {
				return interaction.reply({
					content: 'You can equip up to 5 items only.',
					ephemeral: true,
				});
			}

			if (player.level < item.level) {
				return interaction.reply({
					content: 'Your level is too low to equip this item.',
					ephemeral: true,
				});
			}

			if (item.equipped) {
				return interaction.reply({
					content: `You already have \`${item.itemName}\` equipped.`,
					ephemeral: true,
				});
			}

			await player.updateStats(item.itemName);
			await player.updateItem(id, true);

			await interaction.reply(`You equipped \`${item.itemName}\`.`);
		}
		catch (error) {
			console.error(error);
		}
	},
};
