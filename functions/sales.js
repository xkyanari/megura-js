const { Op } = require('sequelize');
const { Order } = require('../src/db');

/**
 * Sales tracking for a server's special shop: what sold, what it earned (in
 * ores, from completed orders) and what is still waiting for the team.
 * Orders placed before sales tracking have no price or date: they are
 * counted when no period is chosen, but add nothing to revenue.
 */

const DAY = 24 * 60 * 60 * 1000;
const PERIODS = { '7d': 7 * DAY, '30d': 30 * DAY, all: null };
const STATUSES = ['pending', 'processing', 'completed', 'cancelled'];

const ordersFor = (guildID, period = 'all', now = Date.now()) => {
	const where = { guildID };
	if (PERIODS[period]) where.orderedAt = { [Op.gte]: new Date(now - PERIODS[period]) };
	return Order.findAll({ where, order: [['orderID', 'ASC']] });
};

/**
 * { total, byStatus, revenue, unpriced, topItems: [{ itemName, sold, revenue }],
 *   oldestPending: [order] } for the server's orders in the period.
 */
const salesReport = async (guildID, period = 'all', now = Date.now()) => {
	const orders = await ordersFor(guildID, period, now);
	const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
	const items = new Map();
	let revenue = 0;
	let unpriced = 0;

	for (const order of orders) {
		byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
		if (order.status === 'cancelled') continue;
		const item = items.get(order.itemName) ?? { itemName: order.itemName, sold: 0, revenue: 0 };
		item.sold += 1;
		if (order.status === 'completed') {
			if (order.price === null) {
				unpriced += 1;
			}
			else {
				revenue += order.price;
				item.revenue += order.price;
			}
		}
		items.set(order.itemName, item);
	}

	const topItems = [...items.values()].sort((a, b) => b.sold - a.sold || b.revenue - a.revenue).slice(0, 5);
	const oldestPending = orders
		.filter((order) => order.status === 'pending' || order.status === 'processing')
		.slice(0, 5);
	return { total: orders.length, byStatus, revenue, unpriced, topItems, oldestPending };
};

const csvField = (value) => {
	let text = value === null || value === undefined ? '' : String(value);
	// a text cell starting with = + - @ would run as a formula in a spreadsheet
	if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// The period's orders as CSV, one row per order.
const salesCsv = async (guildID, period = 'all', now = Date.now()) => {
	const orders = await ordersFor(guildID, period, now);
	const header = ['order', 'buyer_id', 'item', 'price_ores', 'status', 'ordered_at'];
	const rows = orders.map((order) => [
		order.orderID,
		order.discordID,
		order.itemName,
		order.price,
		order.status,
		order.orderedAt ? new Date(order.orderedAt).toISOString() : '',
	]);
	return [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n') + '\n';
};

module.exports = { PERIODS, STATUSES, salesReport, salesCsv };
