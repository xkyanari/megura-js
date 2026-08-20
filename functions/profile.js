const {
	EmbedBuilder,
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { Player } = require('../src/db');
const {
	footer,
	// checkProfile
} = require('../src/vars');

module.exports = async (interaction, member) => {
	const button = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('profile')
			.setEmoji('👤')
			.setLabel('Profile')
			.setStyle(ButtonStyle.Success),
		new ButtonBuilder()
			.setCustomId('inventory')
			.setEmoji('🛄')
			.setLabel('Inventory')
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId('shop')
			.setEmoji('🛒')
			.setLabel('Shop')
			.setStyle(ButtonStyle.Danger),
	);

	const numFormat = (value) =>
		new Intl.NumberFormat('en-US').format(value ?? 0);
	const guild = interaction.guild;
	const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';

	try {
		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
			include: 'iura',
		});

		if (!player && member.id === interaction.user.id) {
			throw new Error('profile not found');
		}

		if (!player && member.id !== interaction.user.id) {
			return interaction.reply(
				'This user does not have a voyager profile in this world yet.',
			);
		}

		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('**VOYAGER ID CARD**')
			.setAuthor({ name: `${member.tag}` })
			.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
			.addFields(
				{
					name: '👤 Player Name',
					value: `${player.playerName}`,
					inline: false,
				},
				{
					name: '🔵 Level',
					value: `${player.level}`,
					inline: false,
				},
				// { name: '👥 Faction', value: `${player.faction}`, inline: false },
				{ name: '🩸 HP', value: `${player.totalHealth}`, inline: true },
				{ name: '⚔️ ATK', value: `${player.totalAttack}`, inline: true },
				{ name: '🛡️ DEF', value: `${player.totalDefense}`, inline: true },
				{ name: '🗡️ Weapon', value: `${player.weapon}`, inline: true },
				{ name: '💠 Armor', value: `${player.armor}`, inline: false },
				{
					name: '💰 Iura',
					value: `$${numFormat(player.iura.walletAmount)}`,
					inline: true,
				},
			)
			.setFooter(footer);

		if (player.oresEarned) {
			embed.addFields({
				name: `${oreEmoji} Ores`,
				value: `${numFormat(player.oresEarned)}`,
				inline: true,
			});
		}

		await interaction.reply({
			embeds: [embed],
			components: [button],
		});
	}
	catch (error) {
		console.log(error);
	}
};
