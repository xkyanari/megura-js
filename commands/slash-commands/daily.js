const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Quest, sequelize } = require('../../src/db');
const { claimDaily, MAX_STREAK_BONUS_DAYS } = require('../../functions/daily');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription('Complete a daily quest!'),
	cooldown: 86400000,
	async execute(interaction) {
		const { member, guild } = interaction;

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
			include: 'iura',
		});

		if (!player?.iura) {
			throw new Error('profile not found');
		}

		const quest = await Quest.findAll({
			order: sequelize.random(),
			limit: 1,
		});
		if (!quest.length) {
			// the handler clears the cooldown, so they can try again once quests exist
			throw new Error('no daily quests configured');
		}

		const { streak, reward } = await claimDaily(player.accountID, quest[0]['questReward']);
		const streakText = streak > 1
			? `🔥 **${streak}-day streak!**${streak > MAX_STREAK_BONUS_DAYS ? ' (max bonus)' : ''}`
			: 'Come back within 48 hours to start a streak.';

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setAuthor({ name: `${interaction.user.tag}` })
			.setTitle('**DAILY QUEST**')
			.setThumbnail(
				`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
			)
			.setFooter({ text: 'This bot was made by megura.xyz.' })
			.addFields({
				name: `__**${quest[0]['questName']}**__`,
				value: `${quest[0]['questDescription']}\n\n✨**Reward:**✨\n- ${reward} IURA\n\n${streakText}`,
				inline: false,
			});

		await interaction.reply({ embeds: [embed] });
	},
};
