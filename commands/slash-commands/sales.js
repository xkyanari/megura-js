const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, userMention } = require('discord.js');
const { footer } = require('../../src/vars');
const { salesReport, salesCsv } = require('../../functions/sales');

const PERIOD_NAMES = { '7d': 'the last 7 days', '30d': 'the last 30 days', all: 'all time' };

const orderLine = (order) => {
	const when = order.orderedAt ? `<t:${Math.floor(new Date(order.orderedAt).getTime() / 1000)}:R>` : 'date unknown';
	return `#${order.orderID} \`${order.itemName}\` for ${userMention(order.discordID)}, ${order.status}, ${when}`;
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('sales')
		.setDescription('(Moderators) Special shop sales: what sold, what it earned, what is waiting.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addStringOption((option) =>
			option.setName('period').setDescription('Which orders (default: last 30 days).').addChoices(
				{ name: 'Last 7 days', value: '7d' },
				{ name: 'Last 30 days', value: '30d' },
				{ name: 'All time', value: 'all' },
			),
		)
		.addBooleanOption((option) =>
			option.setName('export').setDescription('Also attach every order as a CSV file.'),
		),
	cooldown: 3000,
	async execute(interaction) {
		if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
			return interaction.reply({ content: 'You need the Moderate Members permission to do that.', flags: 64 });
		}
		const period = interaction.options.getString('period') ?? '30d';
		const guildID = interaction.guild.id;
		const report = await salesReport(guildID, period);

		const { byStatus } = report;
		const top = report.topItems.length
			? report.topItems.map((item, i) => `${i + 1}. **${item.itemName}**: ${item.sold} sold, ${item.revenue} ores`).join('\n')
			: 'No sales yet.';
		const waiting = report.oldestPending.length ? report.oldestPending.map(orderLine).join('\n') : 'Nothing is waiting. 🎉';
		const unpriced = report.unpriced ? `\n${report.unpriced} completed order(s) from before sales tracking have no price.` : '';

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle(`📈 SALES: ${PERIOD_NAMES[period]}`)
			.setDescription(`**${report.total}** order(s): ${byStatus.completed} completed, ${byStatus.processing} processing, ${byStatus.pending} pending, ${byStatus.cancelled} cancelled.\n💎 **Revenue:** ${report.revenue} ores from completed orders.${unpriced}`)
			.addFields(
				{ name: 'Top items', value: top.slice(0, 1024) },
				{ name: 'Oldest waiting orders', value: waiting.slice(0, 1024) },
			)
			.setFooter(footer);

		const files = interaction.options.getBoolean('export')
			? [new AttachmentBuilder(Buffer.from(await salesCsv(guildID, period)), { name: `sales-${period}.csv` })]
			: [];
		await interaction.reply({ embeds: [embed], files, flags: 64 });
	},
};
