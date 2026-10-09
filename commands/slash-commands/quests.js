const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Guild } = require('../../src/db');
const { syncFaction } = require('../../functions/factions');
const { footer } = require('../../src/vars');
const { questBoard } = require('../../functions/quests');
const { nextDayStart, nextWeekStart } = require('../../functions/period');

const progressBar = (progress, target, length = 10) => {
	const filled = Math.round(Math.min(progress / target, 1) * length);
	return `${'▰'.repeat(filled)}${'▱'.repeat(length - filled)}`;
};

const questLine = (quest) => quest.completed
	? `✅ ~~${quest.text}~~ (done)`
	: `⬜ **${quest.text}**\n${progressBar(quest.progress, quest.target)} ${quest.progress}/${quest.target} · ${quest.iura} IURA, ${quest.exp} EXP`;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('quests')
		.setDescription('See your daily and weekly quests.'),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;
		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) {
			throw new Error('profile not found');
		}

		// faction quests depend on the member's faction role (only matters on the day's first look)
		await syncFaction(player, await Guild.findOne({ where: { guildID: guild.id } }), member);
		const board = await questBoard(player);
		const section = (period) => board.filter((quest) => quest.period === period).map(questLine).join('\n\n') || 'Nothing this time.';
		const resets = (time) => `<t:${Math.floor(time / 1000)}:R>`;

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('📜 QUESTS')
			.setDescription('Rewards are paid as soon as a quest is done, and grow with your level.')
			.addFields(
				{ name: `Daily (new quests ${resets(nextDayStart())})`, value: section('daily') },
				{ name: `Weekly (new quests ${resets(nextWeekStart())})`, value: section('weekly') },
			)
			.setFooter(footer);
		await interaction.reply({ embeds: [embed], flags: 64 });
	},
};
