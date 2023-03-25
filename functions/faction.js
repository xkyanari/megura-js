const { EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = async (interaction) => {
    const member = interaction.member;
    const guild = interaction.guild;

    const margaretha = guild.roles.cache.get('1073827215957032968');
    const cerberon = guild.roles.cache.get('1073827215957032969');

    const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});

    if (!player) return interaction.reply("You do not have a player profile in this world yet.");

        try {
            if (member.roles.cache.some(role => role.name === margaretha.name)) {
                await member.roles.remove(margaretha);
            }
            if (member.roles.cache.some(role => role.name === cerberon.name)) {
                return interaction.reply({ content: `You are on ${cerberon.name} faction!` });
            }
            
            await member.roles.add(cerberon);
            player.faction = "Cerberon";
            const embed = new EmbedBuilder()
                .setDescription(`Removed \`${margaretha.name}\`\nAdded \`${cerberon.name}\``);
            await interaction.reply({ embeds: [embed] });
            return player.save();

        } catch (error) {
            console.log(error);
        }
};