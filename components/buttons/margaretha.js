const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `margaretha`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const margaretha = guild.roles.cache.get('1073827215957032968');
        const cerberon = guild.roles.cache.get('1073827215957032969');

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.reply("You do not have a player profile in this world yet.");

            try {
                if (member.roles.cache.some(role => role.name === cerberon.name)) {
                    await member.roles.remove(cerberon);
                }
                if (member.roles.cache.some(role => role.name === margaretha.name)) {
                    return interaction.reply({ content: `You are on ${margaretha.name} faction!` });
                }
                
                await member.roles.add(margaretha);
                player.faction = "Margaretha";
                const embed = new EmbedBuilder()
                .setDescription(`Removed \`${cerberon.name}\`\nAdded \`${margaretha.name}\``);
                await interaction.reply({ embeds: [embed] });
                return player.save();

            } catch (error) {
                console.log(error);
            }
    }
};