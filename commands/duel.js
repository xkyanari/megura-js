const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Player, Iura } = require('../src/db');
const {
    expPoints,
    duel_iuraGained,
    duel_expGained,
} = require('../src/vars');
const { simulateBattle } = require('../functions/battle');
const leveling = require('../functions/level');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Request for duel')
        .addUserOption(option =>
            option
            .setName('target')
            .setDescription('Choose the player you want to fight.')
            .setRequired(true)),
    cooldown: 600000,
    async execute(interaction) {
        const wait = require('node:timers/promises').setTimeout;
        const player1 = interaction.member;
        const player2 = interaction.options.getMember('target');

        await interaction.deferReply();

        if (player1.id === player2.id) return interaction.editReply("There is a saying that goes:```“The attempt to force human beings to despise themselves is what I call hell.” ― Andre Malraux```Sorry, I cannot allow that.");
        if (interaction.client.user.id === player2.id) return interaction.editReply("I don't engage in battles.");
        if (player2.user.bot) return interaction.editReply("You cannot duel with bots.");

        try {
            const players = await Player.findAll({ 
                where: { 
                    discordID: [player1.id, player2.id],
                    guildID: interaction.guild.id 
                }, 
                include: 'iura' 
            });

            let p1Index = players.findIndex(p => p.discordID === player1.id);
            let p1;

            if (p1Index !== -1) {
            p1 = players[p1Index];
            }

            if (p1Index !== 0) {
            [players[0], players[p1Index]] = [players[p1Index], players[0]];
            p1Index = 0;
            }

            const updatedPlayer1 = players[0];
            const updatedPlayer2 = players[1];

            if (players.length === 2) {
                // checking rank
                if ((updatedPlayer2.totalHealth - updatedPlayer1.totalHealth) >= 5000) return interaction.editReply("Your rank is too low to fight this player.");
                if ((updatedPlayer2.totalHealth - updatedPlayer1.totalHealth) <= -5000) return interaction.editReply("Your rank is too high to fight this player.");

                // checking balance
                // if (updatedPlayer1.iura.walletAmount < 100) return interaction.editReply("You do not have sufficient balance to duel! Please carry at least $100 IURA first.");
                // if (updatedPlayer2.iura.walletAmount < 100) return interaction.editReply("This player does not have enough balance to be attacked.");

                await interaction.editReply("The battle commences!");
                await wait(1000);
                await interaction.channel.send("Starting in 10 seconds...");
                await wait(10000);
                const winner = await simulateBattle(interaction, updatedPlayer1, updatedPlayer2);

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

                if (winner === updatedPlayer1) {
                    await interaction.channel.send(`The battle has concluded.`);
                    await interaction.followUp({content: `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${duel_iuraGained} IURA\`\n\n- \`${duel_expGained} EXP\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`, components: [button]});

                    await Iura.decrement({ walletAmount: duel_iuraGained }, { where: { accountID: updatedPlayer2.iura.accountID } });
                    await Iura.increment({ walletAmount: duel_iuraGained }, { where: { accountID: updatedPlayer1.iura.accountID } });
                    await updatedPlayer1.increment({ iuraEarned: duel_iuraGained, expGained: duel_expGained, duelKills: 1 });

                    if (updatedPlayer1.expGained > expPoints(updatedPlayer1.level)) {
                        const levelUp = await leveling(interaction.member.id);
                        await interaction.channel.send(`\`${updatedPlayer1.playerName}\`, you have leveled up to **${levelUp.level}**!`);
                    }
                } else if (winner === updatedPlayer2) {
                    await interaction.channel.send(`The battle has concluded.`);
                    await interaction.followUp("👎 **YOU LOST!**");
                    await interaction.channel.send({content: `> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`, components: [button]});
                    await Iura.increment({ walletAmount: duel_iuraGained }, { where: { accountID: updatedPlayer2.iura.accountID } });
                    await Iura.decrement({ walletAmount: duel_iuraGained }, { where: { accountID: updatedPlayer1.iura.accountID } });
                }
            } else if (!updatedPlayer1) {
                await interaction.editReply(`${player1.user.tag} do not have a voyager profile yet.`);
            } else if (!updatedPlayer2) {
                await interaction.editReply(`${player2.user.tag} does not have a voyager profile yet.`);
            } else {
                await interaction.editReply(`Both players do not have voyager profiles yet.`);
            }
        } catch (error) {
            console.log(error);
        }
    }
};