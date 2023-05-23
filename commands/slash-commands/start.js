const Discord = require('discord.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Guild } = require('../../src/db');
const { wanderer } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Create your own profile!'),
    cooldown: 3000,
	async execute(interaction) {
        const { channel, member, guild } = interaction;

        try {
            const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
            // const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
    
            // if (!guildCheck || !guildCheck.margarethaName || !guildCheck.cerberonName) return interaction.reply(`This world does not seem to have proper faction roles added. I'm assigning you to the \`${wanderer}\` faction.`);
            
            // const factionCheck = guild.roles.cache.find(role => role.name === guildCheck.margarethaName || role.name === guildCheck.cerberonName);
            // const faction = factionCheck === undefined ? wanderer : factionCheck.name;
            if (player) return interaction.reply("You're all set!");
                
                const embed = new EmbedBuilder()
                .setColor(0xCD7F32)
                .setTitle('Start your Adventure!')
                // .setDescription(
                //     `***Welcome to Eldelvain's Voyagers Guild.***\n\nI see that you belong to the \`${faction}\` faction. Before you can start your journey, I need to get information from you first.\n\nPlease enter your \`Character Name\`.\n\nYou can have a name with up to 20 characters including spaces and numbers. You cannot use any special symbols as I will address you by this name moving forward.`
                //     );
                .setDescription(
                    `***Welcome to Eldelvain's Voyagers Guild.***\n\nBefore you can start your journey, I need to get information from you first.\n\nPlease enter your \`Character Name\`.\n\nYou can have a name with up to 20 characters including spaces and numbers. You cannot use any special symbols as I will address you by this name moving forward.`
                    );
                await interaction.reply({ embeds: [embed], ephemeral: true });
    
                let attempt = 0;
                try {
                    do {
                    const filter = m => m.author.id === member.id;
                    const collected = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
                    const player_name = collected.first();
                    await player_name.delete();
                    
                    if (player_name.content.length <= 20) {
                        await interaction.followUp({ content: `\`${player_name.content}\`, right? Y/N`, ephemeral: true });
                        let message = await channel.awaitMessages({ filter, max: 1, time: 120_000, errors: ['time'] });
                        let confirm = message.first();
                        await confirm.delete();
    
                        if (confirm.content === 'Y' || confirm.content === 'y') {
                            await interaction.followUp({ content: `Thank you, \`${player_name.content}\`. That's a good name!`, ephemeral: true });
                            // creates a player profile in the db
                            const create_profile = await Player.create({ guildID: guild.id, discordID: member.id, playerName: player_name.content, faction: wanderer });
                            await create_profile.createIura({ walletName: player_name.content, bankName: player_name.content });
                            const wait = require('node:timers/promises').setTimeout;
                            await wait(1000);
    
                            const embed1 = new EmbedBuilder()
                                .setDescription("You are now part of the **<REDACTED> system v. 35.0.56**.\n\nYou will be assigned to take part in battles against `Conflicts` surrounding Eldelvain. These are simulation created by an unknown entity in this world named _**Messinia Graciene**_. Origin is also unknown.\nAs they say, for as long as life exists, death and Conflicts follow.");
                            await interaction.followUp({ embeds: [embed1], ephemeral: true });
                            await wait(3000);
                            const embed2 = new EmbedBuilder()
                                .setDescription("I will carry your Voyagers ID so you will be reminded of your identity.\nUse `/profile` for yourself or when you find your friends and enemies.\n\nIf you're searching for a Conflict, use `/attack`. There's also `/duel` to challenge other voyagers.\n\nI highly recommend that you explore the areas outside Eldelvain or challenge other voyagers using `/open` so you don't interfere with other voyagers. Take heed that it closes momentarily.\n\nIf you need to leave early, use the `/close` command. You will be reminded how to use them with care.\n\nLastly, you can use `/info` to see the list of commands to call me.");
                            await interaction.followUp({ embeds: [embed2], ephemeral: true });
                            await wait(4000);
                            await interaction.followUp({ content: `For now, you will travel to the \`past\`. Please take care, \`${player_name.content}\`.`, ephemeral: true});
                            break;
                        } else if (confirm.content === 'N' || confirm.content === 'n' && attempt < 1) {
                            await interaction.followUp({ content: "Alright. Please enter your \`Character Name\`.", ephemeral: true });
                        } else {
                            await interaction.followUp({ content: "Sorry, I did not get that. Please come back when you're ready.", ephemeral: true });
                            break;
                        }
                    } else {
                        await interaction.followUp({ content: "Your name is too long. I can't put that in our database.", ephemeral: true });
                    }
                    attempt++;
                    if (attempt == 2) {
                        await interaction.followUp({ content: "Sorry, please come back when you're ready.", ephemeral: true });
                    }
                    } while (attempt < 2);
                } catch (error) {
                    if (error instanceof Discord.Collection) {
                        // timed out after 2mins
                        await interaction.followUp({ content: "Do you need more time? That's okay. Just run the command again when you're ready.", ephemeral: true });
                    } else {
                        console.log(error);
                    }
                };
        } catch (error) {
            console.error(error);
        }
	}
};