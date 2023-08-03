const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	userMention,
} = require('discord.js');
const { Player, Monster, Iura, sequelize } = require('../src/db');
const { simulateBattle } = require('./battle');
const { expPoints } = require('../src/vars');
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

const executeAttack = async (interaction) => {
	const wait = require('node:timers/promises').setTimeout;
	const { member, guild } = interaction;

	await interaction.deferReply();
	const player = await Player.findOne({
		where: { discordID: member.id, guildID: guild.id },
		include: 'iura',
	});

	if (!player) {
		throw new Error('profile not found');
	}

	try {
		const [monster] = await Monster.findAll({
			order: sequelize.random(),
			limit: 1,
		});

		const playerObj = {
			guildID: player.guildID,
			discordID: player.discordID,
			playerName: player.playerName,
			level: player.level,
			totalHealth: player.totalHealth,
			totalAttack: player.totalAttack,
			totalDefense: player.totalDefense,
			expGained: player.expGained,
		};

		const scalingFactor = 1 + player.level * 0.25;

		const monsterObj = {
			playerName: monster.monsterName,
			level: monster.level,
			totalHealth: Math.round(monster.totalHealth * scalingFactor),
			totalAttack: Math.round(monster.totalAttack * scalingFactor),
			totalDefense: Math.round(monster.totalDefense * scalingFactor),
			expDropped: monster.expDropped,
			iuraDropped: monster.iuraDropped,
		};

		const embed1 = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setDescription('Searching for a monster...');
		await interaction.editReply({ embeds: [embed1] });

		await wait(1000);

		const embed2 = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setDescription(`Target locked. A **${monster.monsterName}** has appeared! Engaging in 5 seconds...`);
		await interaction.channel.send({ embeds: [embed2] });

		const imageEmbed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setImage(monster.imageURL);
		await interaction.channel.send({ embeds: [imageEmbed] });

		await wait(5000);
		const winner = await simulateBattle(interaction, playerObj, monsterObj);

		const button = new ActionRowBuilder().addComponents(
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

		if (winner === playerObj) {
			const victoryQuote = getRandomVictoryQuote();
			await interaction.channel.send('The battle has concluded.');
			await interaction.followUp({
				content: `${userMention(interaction.member.id)}\n\n🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${monsterObj.iuraDropped} IURA\`\n- \`${monsterObj.expDropped} EXP\`\n\n> “${victoryQuote}”`,
				components: [button],
			});

			await Iura.increment(
				{ walletAmount: monsterObj.iuraDropped },
				{ where: { accountID: player.iura.accountID } },
			);
			await player.increment({
				iuraEarned: monsterObj.iuraDropped,
				expGained: monsterObj.expDropped,
				monsterKills: 1,
			});
		}

		if (winner === monsterObj) {
			const defeatQuote = getRandomDefeatQuote();
			await interaction.channel.send('The battle has concluded.');
			await interaction.followUp({
				content: `${userMention(interaction.member.id)}\n\n😔 **Better luck next time!**\n\n> “${defeatQuote}”`,
				components: [button],
			});
		}

		if (playerObj.expGained > expPoints(playerObj.level)) {
			const levelUp = await leveling(playerObj.guildID, playerObj.discordID);
			await levelcheck(interaction, levelUp.level);
		}
	}
	catch (error) {
		console.log(error);
	}
};

module.exports = { executeAttack };
