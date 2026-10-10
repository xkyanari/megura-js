const { EmbedBuilder } = require('discord.js');
const { footer } = require('../src/vars');

const colors = {
	default: 0xcd7f32,
	explore: 0x5da89c,
	victory: 0x57a773,
	defeat: 0xc76565,
	inventory: 0x9b87c4,
};

const gameEmbed = (tone = 'default') => new EmbedBuilder()
	.setColor(colors[tone] ?? colors.default)
	.setFooter(footer);

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);

const progressBar = (current, max, length = 10) => {
	const ratio = max > 0 ? Math.min(Math.max(current / max, 0), 1) : 0;
	const filled = Math.round(ratio * length);
	return `${'▰'.repeat(filled)}${'▱'.repeat(length - filled)}`;
};

module.exports = { colors, gameEmbed, formatNumber, progressBar };
