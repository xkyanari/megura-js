const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const { MAX_EQUIPPED_KINDS, changeEquipment } = require('../../functions/equipment');

const REFUSALS = {
	'amount': 'Please enter an amount of at least 1.',
	'not owned': 'You don\'t own that item.',
	'level': 'Your level is too low to equip this item.',
	'limit': `You can equip up to ${MAX_EQUIPPED_KINDS} different items only.`,
	'not enough': 'You do not have enough of that item to equip.',
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('equip')
		.setDescription('Equip an item.')
		.addStringOption((option) =>
			option.setName('id').setDescription('Enter item ID.').setRequired(true),
		)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription('Enter amount.').setMinValue(1).setRequired(true),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;

		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) {
			throw new Error('profile not found');
		}

		const result = await changeEquipment(player.accountID, options.getString('id'), options.getInteger('amount'), true);
		if (!result.ok) {
			return interaction.reply({ content: REFUSALS[result.reason], flags: 64 });
		}
		await interaction.reply({ content: `You equipped \`${result.itemName}\`.`, flags: 64 });
	},
};
