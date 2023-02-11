const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('changenick')
		.setDescription('Update your profile'),
	async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;
        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});

        if (player !== null) {
            const nick = player.playerName;

            await interaction.reply(`You want to change your name from \`${nick}\`? Okay. What should I call you?\nYou have 3 attempts.`)
                .catch(console.error);
            
            let attempt = 0;
            try {
                do {
                    const filter = m => m.author.id === member.id;
                    let collected = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
                    let player_name = collected.first();

                    if (player_name.content.length <= 20) {
                        await channel.send(`\`${player_name.content}\`, right? Y/N`);
                        let message = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
                        let confirm = message.first();
                        if (confirm.content === 'Y' || confirm.content === 'y') {
                            await channel.send(`Thank you \`${player_name.content}\`. I like your old name though.`);
                            await Player.update({ playerName: player_name.content }, {
                                where: {
                                    guildID: guild.id,
                                    discordID: member.id
                                }
                            }).then(data => console.log("Player update successful!"));
                            break;
                        } else if (confirm.content === 'N' || confirm.content === 'n' && attempt < 2) {
                            let left = 2 - attempt
                            await channel.send(`Alright. What should I call you?\nYou have ${left} attempt/s left.`);
                        } else {
                            await channel.send("Sorry, I did not get that. Please come back when you're ready.");
                            break;
                        }
                    } else {
                        await channel.send("Your name is too long. What should I call you?");
                    }
                    attempt++;
                    if (attempt == 3) {
                        await channel.send("You've reached the maximum attempts. Just run the command again when you make up your mind.");
                    }
                } while (attempt < 3);
            } catch (error) {
                await channel.send("Do you need more time? That's okay. Just run the command again when you're ready.");
            }
        } else {
            await interaction.reply("You do not have a player profile in this world yet. Wanna `/start`?");
        }
    }
};