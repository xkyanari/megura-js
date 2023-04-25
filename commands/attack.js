const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Player, Monster, Iura, sequelize } = require('../src/db');
const { simulateBattle } = require('../functions/battle');
const { expPoints } = require('../src/vars');
const leveling = require('../functions/level');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('attack')
		.setDescription('Attack a random monster'),
    cooldown: 25000,
	async execute(interaction) {
        const wait = require('node:timers/promises').setTimeout;
        const { member, guild } = interaction;

        await interaction.deferReply();
        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.editReply("You do not have a player profile in this world yet.");

            try {
                const levelCheck = player.totalAttack < 2500 ? 1 : 2;

                const [ monster ] = await Monster.findAll({ order: sequelize.random(), limit: 1, where: { level: levelCheck } });

                const playerObj = {
                    playerName: player.playerName,
                    level: player.level,
                    totalHealth: player.totalHealth,
                    totalAttack: player.totalAttack,
                    totalDefense: player.totalDefense
                };

                const monsterObj = {
                    playerName: monster.monsterName,
                    level: monster.level,
                    totalHealth: monster.totalHealth,
                    totalAttack: monster.totalAttack,
                    totalDefense: monster.totalDefense,
                    expDropped: monster.expDropped,
                    iuraDropped: monster.iuraDropped
                };

                await interaction.editReply("Searching for a monster...");
                await wait(1000);
                await interaction.channel.send("Target locked. Engaging in 5 seconds...");
                await wait(5000);
                const winner = await simulateBattle(interaction, playerObj, monsterObj);

                const button = new ActionRowBuilder()
                    .addComponents(
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
                        .setStyle(ButtonStyle.Danger)
                );

                if (winner === playerObj) {
                    await interaction.channel.send(`The battle has concluded.`);
                    await interaction.followUp({content: `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${monsterObj.iuraDropped} IURA\`\n\n- \`${monsterObj.expDropped} EXP\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`, components: [button]});

                    await Iura.increment({ walletAmount: monsterObj.iuraDropped }, { where: { accountID: player.iura.accountID } });
                    await player.increment({ iuraEarned: monsterObj.iuraDropped, expGained: monsterObj.expDropped, monsterKills: 1 });

                    if (playerObj.expGained > expPoints(playerObj.level)) {
                        const levelUp = await leveling(interaction.member.id);
                        await interaction.channel.send(`\`${playerObj.playerName}\`, you have leveled up to **${levelUp.level}**!`);
                    }
                } else if (winner === monsterObj) {
                    await interaction.channel.send(`The battle has concluded.`);
                    await interaction.followUp("👎 **YOU LOST!**");
                    await interaction.channel.send({content: `> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`, components: [button]});
                }
            } catch (error) {
                console.log(error);
            }
	}
};