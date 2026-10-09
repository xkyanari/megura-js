const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const { SLOT_LIMITS, changeEquipment } = require('../../functions/equipment');

const REFUSALS = {
	'not owned': 'You don\'t own that item.',
	'level': 'Your level is too low to equip this item.',
	'consumable': 'Consumables can\'t be equipped. They are used automatically when your health runs low in a fight.',
	'equipped': 'You already have that item equipped.',
	'slot': `Your slots are full (${SLOT_LIMITS.weapons} weapon, ${SLOT_LIMITS.armor} armor, ${SLOT_LIMITS.miscellaneous} accessory). Unequip one first.`,
	'not enough': 'You do not have enough of that item to equip.',
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('equip')
		.setDescription('Equip an item.')
		.addStringOption((option) =>
			option.setName('id').setDescription('Enter item ID.').setRequired(true),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;

		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) {
			throw new Error('profile not found');
		}

		const result = await changeEquipment(player.accountID, options.getString('id'), 1, true);
		if (!result.ok) {
			return interaction.reply({ content: REFUSALS[result.reason], flags: 64 });
		}
		await interaction.reply({ content: `You equipped \`${result.itemName}\`.`, flags: 64 });
	},
};
