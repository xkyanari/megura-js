const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { min_atk_rate, min_def_rate, blessing, crit_rate } = require('../src/vars');
const { Player, Monster, Iura, sequelize } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('attack')
		.setDescription('Attack a random monster'),
    cooldown: 25000,
	async execute(interaction) {
        const wait = require('node:timers/promises').setTimeout;
        const channel = interaction.channel;
        const member = interaction.member;
        const guild = interaction.guild;

        await interaction.deferReply();
        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.editReply("You do not have a player profile in this world yet.");

            try {
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

                const levelCheck = player.totalAttack < 2500 ? 1 : 2;
                const monster = await Monster.findAll({ order: sequelize.random(), limit: 1, where: { level: levelCheck }});
                
                const p1_name = player.playerName;
                const p2_name = monster[0]["monsterName"];
                const p2_expGained = monster[0]["expDropped"];
                const p2_iuraGained = monster[0]["iuraDropped"];

                await interaction.editReply("Searching for a monster...");
                await wait(1000);
                await channel.send("Target locked. Engaging in 5 seconds...");
                await wait(5000);

                let p2_health = monster[0]["totalHealth"];
                while (p2_health > 0) {
                    const p1_max_atk = player.totalAttack;
                    const p1_min_atk = p1_max_atk - (p1_max_atk * min_atk_rate);
                    const p2_max_def = monster[0]["totalDefense"];
                    const p2_min_def = p2_max_def - (p2_max_def * min_def_rate);

                    let d = Math.round((Math.random() * p1_max_atk) + p1_min_atk);
                    let de = Math.round((Math.random() * p2_max_def) + p2_min_def);
                    let atk = Math.round(d * (d / (d + de)));
                    let atk1 = Math.round(blessing + (atk + (atk * crit_rate)));
                    let rand_values = new Array(0, 1);
                    let rand_i = Math.floor(Math.random() * rand_values.length);

                    await wait(1000);

                    if (rand_i === 1) {
                        let remainingHealth1 = p2_health - atk1;
                        let message = await channel.send(`**CRITICAL HIT !!** ${p1_name} dealt ${atk1} damage to ${p2_name}! ${p2_name} has ${remainingHealth1} remaining.`);
                        if (remainingHealth1 <= 0) {
                            await message.edit(`${p2_name} has ran away.`);
                            break;
                        }
                    }
                    
                    else {
                        let remainingHealth2 = p2_health - atk;
                        let message = await channel.send(`${p1_name} dealt ${atk1} damage to ${p2_name}! ${p2_name} has ${remainingHealth2} remaining.`);
                        if (remainingHealth2 <= 0) {
                            await message.edit(`${p2_name} has ran away.`);
                            break;
                        }
                    }
                    p2_health -= atk;
                }
                await wait(2000);
                await channel.send("The battle has concluded.");
                await interaction.followUp({ content: `Well done! You received the following from the battle: \n\n- \`${p2_expGained} EXP\`\n- \`${p2_iuraGained} IURA\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`, components: [button]});
                await Iura.increment({ walletAmount: p2_iuraGained}, { where: { accountID: player.iura.accountID } });
                await Player.increment({ iuraEarned: p2_iuraGained, monsterKills: 1 }, { where: { discordID: member.id }});
            } catch (error) {
                console.log(error);
            }
	}
};