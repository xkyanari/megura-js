const { EmbedBuilder } = require('discord.js');
const { Player, Guild } = require('../../src/db');

module.exports = {
	data: {
		name: 'margaretha',
	},
	async execute(interaction) {
		const member = interaction.member;
		const guild = await Guild.findOne({
			where: { guildID: interaction.guild.id },
		});
		const player = await Player.findOne({
			where: { discordID: member.id, guildID: interaction.guild.id },
		});
		if (!player) {
			return interaction.reply(
				'You do not have a player profile in this world yet.',
			);
		}
		if (!guild || !guild.margarethaID || !guild.cerberonID) return;

		const margaretha = interaction.guild.roles.cache.get(guild.margarethaID);
		const cerberon = interaction.guild.roles.cache.get(guild.cerberonID);

		try {
			const embed = new EmbedBuilder();

			if (member.roles.cache.some((role) => role.name === margaretha.name)) {
				return interaction.reply({
					content: `You are on ${margaretha.name} faction!`,
				});
			}

			if (member.roles.cache.some((role) => role.name === cerberon.name)) {
				await member.roles.remove(cerberon);
				embed.setDescription(
					`Removed \`${cerberon.name}\`.\nAdded \`${margaretha.name}\`.`,
				);

				await member.roles.add(margaretha);
				player.faction = margaretha.name;

				await interaction.reply({ embeds: [embed] });
				return player.save();
			}
			else {
				await member.roles.add(margaretha);
				player.faction = margaretha.name;
				embed.setDescription(`Added \`${margaretha.name}\`.`);

				await interaction.reply({ embeds: [embed] });
				return player.save();
			}
		}
		catch (error) {
			console.log(error);
		}
	},
};
