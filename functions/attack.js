const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	userMention,
} = require('discord.js');
const { Player, Monster, Iura, sequelize } = require('../src/db');
const { simulateBattle } = require('./battle');
const { expPoints, checkProfile } = require('../src/vars');
const leveling = require('./level');
const levelcheck = require('./levelup');

const executeAttack = async (interaction) => {
	const wait = require('node:timers/promises').setTimeout;
	const { member, guild } = interaction;

	await interaction.deferReply();
	const player = await Player.findOne({
		where: { discordID: member.id, guildID: guild.id },
		include: 'iura',
	});

	if (!player) {
		return interaction.editReply(checkProfile);
	}

	try {
		const levelCheck = player.totalAttack < 2500 ? 1 : 2;

		const [monster] = await Monster.findAll({
			order: sequelize.random(),
			limit: 1,
			where: { level: levelCheck },
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

		await interaction.editReply('Searching for a monster...');
		await wait(1000);
		await interaction.channel.send(`Target locked. A **${monster.monsterName}** has appeared! Engaging in 5 seconds...`);
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
			await interaction.channel.send('The battle has concluded.');
			await interaction.followUp({
				content: `${userMention(interaction.member.id)}\n\n🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${monsterObj.iuraDropped} IURA\`\n- \`${monsterObj.expDropped} EXP\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`,
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
			await interaction.channel.send('The battle has concluded.');
			await interaction.followUp({
				content: `${userMention(interaction.member.id)}\n\n👎 **YOU LOST!**\n\n> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`,
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
