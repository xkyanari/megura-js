const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Create your own profile!'),
	async execute(interaction) {
        const guild = interaction.guild;
        const member = interaction.member;
        const channel = interaction.channel;
        const faction = member.roles.cache.find(role => role.name === 'Margaretha' || role.name === 'Cerberon');

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });

        if (player === null) {
            if (member.roles.cache.some(role => role.name === 'Margaretha' || role.name === 'Cerberon')) {
                const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Start your Adventure!')
                .setDescription(
                    `***Welcome to Eldelvain's Adventurers Guild.***\n\nI see that you belong to the \`${faction.name}\` faction. Before you can start your journey, I need to get information from you first.\n\nPlease enter your \`Character Name\`.\n\nYou can have a name with up to 20 characters including spaces and numbers. You cannot use any special symbols as I will address you by this name moving forward.`
                    );
                await interaction.reply({ embeds: [embed] });

                let attempt = 0;
                try {
                    do {
                    const filter = m => m.author.id === member.id;
                    const collected = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
                    const player_name = collected.first();
                    
                    if (player_name.content.length <= 20) {
                        await channel.send(`\`${player_name.content}\`, right? Y/N`);
                        let message = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
                        let confirm = message.first();
                        if (confirm.content === 'Y' || confirm.content === 'y') {
                            channel.send(`Thank you, \`${player_name.content}\`. That's a good name!`);
                            // creates a player profile in the db
                            const create_profile = await Player.create({ guildID: guild.id, discordID: member.id, playerName: player_name.content, faction: faction.name });
                            await create_profile.createIura({ walletName: player_name.content, bankName: player_name.content });
                            console.log("Profile and Iura creation successful!");
                            const wait = require('node:timers/promises').setTimeout;
                            await wait(1000);
                            const embed1 = new EmbedBuilder()
                                .setDescription("You are now part of the **<REDACTED> system v. 35.0.56**.\n\nYou will be assigned to take part in battles against `Conflicts` surrounding Eldelvain. These are simulation created by an unknown entity in this world named _**Messinia Graciene**_. Origin is also unknown.\nAs they say, for as long as life exists, death and Conflicts follow.");
                            await channel.send({ embeds: [embed1] });
                            await wait(3000);
                            const embed2 = new EmbedBuilder()
                                .setDescription("I will carry your Adventurer ID so you will be reminded of your identity.\nUse `/profile` for yourself or when you find your friends and enemies.\n\nIf you're searching for a Conflict, use `/attack`. There's also `/duel` to challenge other adventurers.\n\nI highly recommend that you explore the areas outside Eldelvain or challenge other adventurers using `/open` so you don't interfere with other adventurers. Take heed that it closes momentarily.\n\nIf you need to leave early, use the `/close` command. You will be reminded how to use them with care.\n\nLastly, you can use `/info` to see the list of commands to call me.");
                            await channel.send({ embeds: [embed2] });
                            await wait(4000);
                            await channel.send(`For now, you will travel to the \`past\`. Please take care, \`${player_name.content}\`.`);
                            break;
                        } else if (confirm.content === 'N' || confirm.content === 'n' && attempt < 1) {
                            await channel.send("Alright. Please enter your \`Character Name\`.");
                        } else {
                            await channel.send("Sorry, I did not get that. Please come back when you're ready.");
                            break;
                        }
                    } else {
                        channel.send("Your name is too long. I can't put that in our database.");
                    }
                    attempt++;
                    if (attempt == 2) {
                        await channel.send("Sorry, please come back when you're ready.");
                    }
                    } while (attempt < 2);
                } catch (error) {
                    // timed out after 2mins
                    channel.send("Do you need more time? That's okay. Just run the command again when you're ready.");
                    console.log(error);
                };
                
            } else {
                await interaction.reply("You don't seem to have a proper faction yet. Please choose your faction then `/start` again.");
            }
        } else {
            interaction.reply("You're all set!");
        }
	}
};