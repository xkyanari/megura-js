const { Op } = require('sequelize');
const { PermissionFlagsBits, userMention } = require('discord.js');
const { Order, Player, Shop } = require('../src/db');
const { purchaseStatus } = require('./webhook');

/**
 * Special-shop orders move pending → processing → completed or cancelled.
 * Completed and cancelled are final. Each move is claimed with a single
 * conditional UPDATE, so double clicks can't deliver or refund twice.
 */

const FROM = {
	processing: ['pending'],
	completed: ['pending', 'processing'],
	cancelled: ['pending', 'processing'],
};

const LABELS = { processing: 'Processing', completed: 'Completed', cancelled: 'Cancelled' };

// Order buttons sit in the staff channel; only staff may press them.
const isStaff = (member) => Boolean(member?.permissions?.has(PermissionFlagsBits.ModerateMembers));

// Claims the move to `to`. Returns the order as it was, or a refusal string.
const claim = async (where, to) => {
	const order = await Order.findOne({ where });
	if (!order) return 'Order not found.';

	const [claimed] = await Order.update(
		{ status: to },
		{ where: { ...where, status: { [Op.in]: FROM[to] } } },
	);
	if (!claimed) {
		const current = (await Order.findOne({ where }))?.status ?? order.status;
		return `This order is already ${current}, so it can't be marked as ${to}.`;
	}
	return order;
};

const handleOrderButton = async (interaction, to) => {
	if (!isStaff(interaction.member)) {
		return interaction.reply({ content: 'Only staff can update orders.', flags: 64 });
	}

	const where = { messageID: interaction.message.id, guildID: interaction.guild.id };
	const order = await claim(where, to);
	if (typeof order === 'string') {
		return interaction.reply({ content: order, flags: 64 });
	}

	let note = '';
	try {
		if (to === 'completed') {
			const player = await Player.findOne({ where: { discordID: order.discordID, guildID: interaction.guild.id } });
			if (player) await player.addItem(order.itemName);
			else note = '\nThe buyer no longer has a profile, so the item wasn\'t added to an inventory.';
		}
		if (to === 'cancelled') {
			const refunded = await Shop.returnOres(order.itemName, 1, order.discordID, interaction.guild.id, order.price);
			if (!refunded) note = '\nThe buyer no longer has a profile, so no ores were refunded.';
		}
	}
	catch (error) {
		// put the order back so staff can try again
		await Order.update({ status: order.status }, { where });
		throw error;
	}

	await interaction.reply(`${LABELS[to]} by ${userMention(interaction.user.id)}!${note}`);
	await purchaseStatus(interaction.guild.id, order.discordID, order.itemName, LABELS[to]);
};

module.exports = { FROM, isStaff, handleOrderButton };
