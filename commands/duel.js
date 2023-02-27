const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    min_atk_rate,
    min_def_rate,
    blessing,
    crit_rate,
    // duel_expGained,
    duel_iuraGained } = require('../src/vars');
const { Player, Iura } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('duel')
		.setDescription('Request for duel')
        .addUserOption(option =>
            option
            .setName('target')
            .setDescription('Choose the player you want to fight.')
            .setRequired(true)),
    cooldown: 1800000,
	async execute(interaction) {
        const wait = require('node:timers/promises').setTimeout;
        const channel = interaction.channel;
        const player1 = interaction.member;
        const player2 = interaction.options.getMember('target');

        await interaction.deferReply();

        let players = [player1.id, player2.id];
        searchplayers = [];
        for (i in players) {
            let player = await Player.findOne({ where: { discordID: players[i]}, include: 'iura' });
            searchplayers.push(player);
        }

        if (!player1 || !player2) return interaction.editReply("This user does not have a player profile in this world yet.");
        if (player1.id === player2.id) return interaction.editReply("There is a saying that goes:```“The attempt to force human beings to despise themselves is what I call hell.” ― Andre Malraux```Sorry, I cannot allow that.");
        if (interaction.client.user.id === player2.id) return interaction.editReply("I don't engage in battles.");
        if (player2.user.bot) return interaction.editReply(`You cannot duel with bots.`);

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
                        .setCustomId('wallet')
                        .setEmoji('💰')
                        .setLabel('Wallet')
                        .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                        .setCustomId('bank')
                        .setEmoji('🏦')
                        .setLabel('Bank')
                        .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                        .setCustomId('shop')
                        .setEmoji('🛒')
                        .setLabel('Shop')
                        .setStyle(ButtonStyle.Danger)
                );

                const accountID = searchplayers[0].iura.accountID;
                
                const p1_name = searchplayers[0]['playerName'];
                const p2_name = searchplayers[1]['playerName'];
                const p1_max_atk = searchplayers[0]['totalAttack'];
                const p1_min_atk = p1_max_atk - (p1_max_atk * min_atk_rate);
                const p2_max_def = searchplayers[1]["totalDefense"];
                const p2_min_def = p2_max_def - (p2_max_def * min_def_rate);
                const p2_max_atk = searchplayers[1]['totalAttack'];
                const p2_min_atk = p1_max_atk - (p1_max_atk * min_atk_rate);
                const p1_max_def = searchplayers[0]["totalDefense"];
                const p1_min_def = p2_max_def - (p2_max_def * min_def_rate);

                await interaction.editReply("The battle commences!");
                await wait(1000);
                await channel.send("Starting in 10 seconds...");
                await wait(10000);

                let p1_health = searchplayers[0]['totalHealth'];
                let p2_health = searchplayers[1]['totalHealth'];
                while (p1_health > 0 && p2_health > 0) {
                    let a1 = Math.round((Math.random() * p1_max_atk) + p1_min_atk);
                    let d1 = Math.round((Math.random() * p2_max_def) + p2_min_def);
                    let atk1 = Math.round(a1 * (a1 / (a1 + d1)));
                    let atk_1 = Math.round(blessing + (atk1 + (atk1 * crit_rate)));
                    let rand_values1 = new Array(0, 1);
                    let rand_i = Math.floor(Math.random() * rand_values1.length);

                    await wait(1000);

                    if (rand_i === 1) {
                        let remainingHealth1 = p2_health - atk_1;
                        let message = await channel.send(`**CRITICAL HIT !!** ${p1_name} dealt ${atk_1} damage to ${p2_name}! ${p2_name} has ${remainingHealth1} remaining.`);
                        if (remainingHealth1 <= 0) {
                            await message.edit(`${p2_name} was hit terribly and ran away.`);
                            await wait(2000);
                            await channel.send("The battle has concluded.");
                            await channel.send(`🎉 **YOU WIN!**`);
                            await wait(1000);
                            await interaction.followUp({content: `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${duel_iuraGained} IURA\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`, components: [button]});
                            await Iura.increment({ walletAmount: duel_iuraGained }, { where: { accountID: accountID } });
                            break;
                        }
                        p2_health -= atk_1;
                    }
                    else {
                        let remainingHealth2 = p2_health - atk1;
                        let message = await channel.send(`${p1_name} dealt ${atk1} damage to ${p2_name}! ${p2_name} has ${remainingHealth2} remaining.`);
                        if (remainingHealth2 <= 0) {
                            await message.edit(`${p2_name} was hit terribly and ran away.`);
                            await wait(2000);
                            await channel.send("The battle has concluded.");
                            await channel.send(`🎉 **YOU WIN!**`);
                            await wait(1000);
                            await interaction.followUp({content: `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${duel_iuraGained} IURA\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`, components: [button]});
                            await Iura.increment({ walletAmount: duel_iuraGained }, { where: { accountID: accountID } });
                            break;
                        }
                        p2_health -= atk1;
                    }

                    await wait(1000);
                    
                    let a2 = Math.round((Math.random() * p2_max_atk) + p2_min_atk);
                    let d2 = Math.round((Math.random() * p1_max_def) + p1_min_def);
                    let atk2 = Math.round(a2 * (a2 / (a2 + d2)));
                    let atk_2 = Math.round(blessing + (atk2 + (atk2 * crit_rate)));
                    let rand_values2 = new Array(0, 1);
                    let rand_j = Math.floor(Math.random() * rand_values2.length);
                    if (rand_j === 1) {
                        let remainingHealth3 = p1_health - atk_2;
                        let message = await channel.send(`**CRITICAL HIT !!** ${p2_name} dealt ${atk_2} damage to ${p1_name}! ${p1_name} has ${remainingHealth3} remaining.`);
                        if (remainingHealth3 <= 0) {
                            await message.edit(`${p1_name} dodged the final attack and gave up.`);
                            await wait(1000);
                            await channel.send("👎 **YOU LOST!**");
                            await interaction.followUp({content: `As a result, you lost:\n\n- \`${duel_iuraGained} IURA\`\n\n> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`, components: [button]});
                            await Iura.decrement({ walletAmount: duel_iuraGained }, { where: { accountID: accountID } });
                            break;
                        }
                        p1_health -= atk_2;
                    }
                    else {
                        let remainingHealth4 = p2_health - atk2;
                        let message = await channel.send(`${p2_name} dealt ${atk2} damage to ${p1_name}! ${p1_name} has ${remainingHealth4} remaining.`);
                        if (remainingHealth4 <= 0) {
                            await message.edit(`${p1_name} dodged the final attack and gave up.`);
                            await wait(1000);
                            await channel.send("👎 **YOU LOST!**");
                            await interaction.followUp({content: `As a result, you lost:\n\n- \`${duel_iuraGained} IURA\`\n\n> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`, components: [button]});
                            await Iura.decrement({ walletAmount: duel_iuraGained }, { where: { accountID } });
                            break;
                        }
                        p1_health -= atk2;
                    }
                }
            } catch (error) {
                console.log(error);
            }
	}
};