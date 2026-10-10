const {
	ButtonBuilder,
	ButtonStyle,
	ActionRowBuilder,
} = require('discord.js');
const { Player, Guild } = require('../src/db');
const { wanderer, expPoints } = require('../src/vars');
const { gameEmbed, formatNumber, progressBar } = require('./embedStyle');
const { syncFaction, factionLabel, pointsThisWeek } = require('./factions');
const { currentLocation } = require('./explore');
const { questsDoneThisWeek, placesDiscovered } = require('./rankings');

module.exports = async (interaction, member, { now = Date.now() } = {}) => {
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

	const numFormat = formatNumber;
	const guild = interaction.guild;
	const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';

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

	const guildRow = await Guild.findOne({ where: { guildID: guild.id } });
	// `member` is a user; for your own profile, your roles keep the stored faction in step
	const faction = await syncFaction(player, guildRow, member.id === interaction.user.id ? interaction.member : null);
	const [location, questsDone, places, points] = await Promise.all([
		currentLocation(player.accountID),
		questsDoneThisWeek(player.accountID, now),
		placesDiscovered(player.accountID),
		pointsThisWeek(guild.id, player.accountID, now),
	]);

	const embed = gameEmbed()
		.setTitle('👤 Voyager ID Card')
		.setDescription(`**${player.playerName}** · Level ${player.level}\n\`${progressBar(player.expGained, expPoints(player.level))}\` ${numFormat(player.expGained)} / ${numFormat(expPoints(player.level))} EXP`)
		.setAuthor({ name: `${member.tag}` })
		.setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
		.addFields(
			{ name: '👥 Faction', value: faction ? factionLabel(faction, guildRow) : wanderer, inline: true },
			{ name: '🧭 Exploring', value: location?.name ?? 'Not yet', inline: true },
			{ name: 'Combat stats', value: '\u200b', inline: false },
			{ name: '🩸 HP', value: numFormat(player.totalHealth), inline: true },
			{ name: '⚔️ ATK', value: numFormat(player.totalAttack), inline: true },
			{ name: '🛡️ DEF', value: numFormat(player.totalDefense), inline: true },
			{ name: 'Loadout & wallet', value: '\u200b', inline: false },
			{ name: '🗡️ Weapon', value: `${player.weapon}`, inline: true },
			{ name: '💠 Armor', value: `${player.armor}`, inline: true },
			{
				name: '💰 Iura',
				value: `${numFormat(player.iura?.walletAmount)} IURA`,
				inline: true,
			},
		)
		.addFields(
			{ name: 'This week & discoveries', value: '\u200b', inline: false },
			{ name: '📜 Quests this week', value: `${questsDone}`, inline: true },
			{ name: '🗺️ Places discovered', value: `${places}`, inline: true },
			{ name: '⚔️ Faction points this week', value: `${points}`, inline: true },
		);

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
};
