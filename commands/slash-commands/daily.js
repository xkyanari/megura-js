const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Iura, Quest, sequelize } = require('../../src/db');

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

		if (!player) {
			throw new Error('profile not found');
		}

		try {
			const quest = await Quest.findAll({
				order: sequelize.random(),
				limit: 1,
			});

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
					value: `${quest[0]['questDescription']}\n\n✨**Reward:**✨\n- ${quest[0]['questReward']} IURA`,
					inline: false,
				});

			await interaction.reply({ embeds: [embed] });
			await Iura.increment(
				{ walletAmount: quest[0]['questReward'] },
				{ where: { accountID: player.iura.accountID } },
			);
		}
		catch (error) {
			console.log(error);
		}
	},
};
