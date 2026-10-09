const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	userMention,
} = require('discord.js');
const { Player, Guild } = require('../src/db');
const { currentLocation, monsterAt } = require('./explore');
const { simulateBattle } = require('./battle');
const { expPoints, monsterStats } = require('../src/vars');
const { rollLoot, loadConsumables } = require('./loot');
const { RIVAL_DAMAGE_BONUS, playerFaction, isRival, factionLabel, addFactionPoint } = require('./factions');
const { recordProgress, completedLines } = require('./quests');
const leveling = require('./level');
const levelcheck = require('./levelup');

const getRandomVictoryQuote = () => {
	const victoryQuotes = [
		'I don\'t have a \'Plan B\' because \'Plan A\' never fails.',
		'I\'m like a ninja; when I win, I win quietly. And when I lose, you\'ll never know I was there.',
		'The secret to success is to offend the greatest number of people.',
		'Success is like a fart. It only bothers people when it’s not their own.',
		'I plan on living forever. So far, so good.',
		'I\'m on a whiskey diet. I\'ve lost three days already.',
		'When life gives you lemons, squirt someone in the eye.',
		'I\'m not clumsy. It\'s just the floor hates me, the tables and chairs are bullies, and the walls get in my way!',
		'If at first you don\'t succeed, skydiving is not for you.',
		'I don\'t need a hair stylist, my pillow gives me a new hairstyle every morning.',
	];

	const randomIndex = Math.floor(Math.random() * victoryQuotes.length);
	return victoryQuotes[randomIndex];
};

const getRandomDefeatQuote = () => {
	const defeatQuotes = [
		'Failure is not the opposite of success; it\'s part of success.',
		'I\'ve failed over and over and over again in my life. And that is why I succeed.',
		'Failure is simply the opportunity to begin again, this time more intelligently.',
		'Remember that failure is an event, not a person.',
		'There is no failure except in no longer trying.',
		'When you take risks you learn that there will be times when you succeed and there will be times when you fail, and both are equally important.',
		'It\'s not about how hard you hit. It\'s about how hard you can get hit and keep moving forward.',
		'The only real mistake is the one from which we learn nothing.',
		'Success is not in never failing, but rising every time you fall!',
		'In the middle of difficulty lies opportunity.',
	];

	const randomIndex = Math.floor(Math.random() * defeatQuotes.length);
	return defeatQuotes[randomIndex];
};

const resultButtons = () => new ActionRowBuilder().addComponents(
	new ButtonBuilder()
		.setCustomId('attack')
		.setEmoji('⚔️')
		.setLabel('Attack Again')
		.setStyle(ButtonStyle.Danger),
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
		.setStyle(ButtonStyle.Primary),
);

// The whole fight happens in the command's own reply, edited turn by turn.
const executeAttack = async (interaction, { delay, ambush = false } = {}) => {
	const { member, guild } = interaction;

	await interaction.deferReply();
	const player = await Player.findOne({
		where: { discordID: member.id, guildID: guild.id },
		include: 'iura',
	});

	if (!player) {
		throw new Error('profile not found');
	}

	// monsters come from where the player is exploring (anywhere, if they never have)
	const location = await currentLocation(player.accountID);
	const monster = await monsterAt(location);
	if (!monster) {
		throw new Error('no monsters configured');
	}

	const guildRow = await Guild.findOne({ where: { guildID: guild.id } });
	const faction = playerFaction(player, guildRow);
	const rival = isRival(faction, monster.faction);

	const playerObj = {
		playerName: player.playerName,
		level: player.level,
		totalHealth: player.totalHealth,
		// fighting the rival faction's monsters hits harder
		totalAttack: rival ? Math.round(player.totalAttack * (1 + RIVAL_DAMAGE_BONUS)) : player.totalAttack,
		totalDefense: player.totalDefense,
	};
	const monsterObj = { playerName: monster.monsterName, ...monsterStats(monster, player.level) };
	// deeper locations pay more
	if (location?.rewardBonus) {
		monsterObj.iuraDropped = Math.round(monsterObj.iuraDropped * (1 + location.rewardBonus));
		monsterObj.expDropped = Math.round(monsterObj.expDropped * (1 + location.rewardBonus));
	}

	const opening = ambush ? `⚠️ Ambush! A ${monster.monsterName} attacks!` : `⚔️ A wild ${monster.monsterName} appears!`;
	const title = [
		opening,
		rival && `(rival: ${factionLabel(monster.faction, guildRow)})`,
		location && `· ${location.name}`,
	].filter(Boolean).join(' ').slice(0, 256);
	let lastEmbed;
	const winner = await simulateBattle(interaction, playerObj, monsterObj, {
		title,
		thumbnail: monster.imageURL,
		consumables: await loadConsumables(player.accountID),
		render: (embed) => {
			lastEmbed = embed;
			return interaction.editReply({ embeds: [embed] });
		},
		...(delay && { delay }),
	});

	let result;
	if (winner === playerObj) {
		await player.addIura(monsterObj.iuraDropped);
		await player.increment({
			iuraEarned: monsterObj.iuraDropped,
			expGained: monsterObj.expDropped,
			monsterKills: 1,
		});
		const loot = await rollLoot(player, monster.monsterName);
		if (rival) await addFactionPoint(guild.id, faction, Date.now(), player.accountID);

		const quests = [
			...await recordProgress(player.accountID, 'monsterWin'),
			...(loot ? await recordProgress(player.accountID, 'loot') : []),
			...(rival ? await recordProgress(player.accountID, 'rivalKill') : []),
		];

		const rewards = [
			`- \`${monsterObj.iuraDropped} IURA\``,
			`- \`${monsterObj.expDropped} EXP\``,
			loot && `- 🎁 \`${loot}\``,
			rival && `- ⚔️ +1 for ${factionLabel(faction, guildRow)} this week (+${RIVAL_DAMAGE_BONUS * 100}% damage against rivals)`,
			...completedLines(quests),
		].filter(Boolean).join('\n');
		result = `🎉 **WELL DONE!** You received:\n${rewards}\n\n> “${getRandomVictoryQuote()}”`.slice(0, 1024);
	}
	else if (winner === monsterObj) {
		result = `😔 **Better luck next time!** You retreat to patch yourself up.\n\n> “${getRandomDefeatQuote()}”`;
	}
	else {
		result = '🤝 Neither side could finish the fight.';
	}

	const finalEmbed = EmbedBuilder.from(lastEmbed).addFields({ name: 'Result', value: result });
	await interaction.editReply({
		content: userMention(member.id),
		embeds: [finalEmbed],
		components: [resultButtons()],
	});

	// check the EXP as it is now, after this battle's reward
	await player.reload();
	if (player.expGained >= expPoints(player.level)) {
		const levelUp = await leveling(player.guildID, player.discordID);
		await levelcheck(interaction, levelUp.level);
	}
};

module.exports = { executeAttack };
