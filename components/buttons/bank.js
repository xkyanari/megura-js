const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
	data: {
		name: 'bank',
	},
	async execute(interaction) {
		const member = interaction.member;
		const guild = interaction.guild;

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
			include: 'iura',
		});
		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

		if (!player) {
			return interaction.reply(
				'This user does not have a player profile in this world yet.',
			);
		}

		try {
			const balanceBank = numFormat(player.iura.bankAmount);
			const balanceStaked = numFormat(player.iura.stakedAmount);
			const embed = new EmbedBuilder()
				.setAuthor({ name: `${interaction.user.tag}` })
				.setTitle('Bank Balance')
				.setThumbnail(
					`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
				)
				.setDescription(
					`🏦 **Bank:** $${balanceBank} IURA\n💵 **Staked:** $${balanceStaked} IURA`,
				);
			await interaction.reply({ embeds: [embed] }).catch(console.error);
		}
		catch (error) {
			console.log(error);
		}
	},
};
