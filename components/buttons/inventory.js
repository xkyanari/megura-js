const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `inventory`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'item' });

        if (!player) return interaction.reply("This user does not have a player profile in this world yet.");

        // for (let item = 0; item < player.item.length; item++) {
        //     console.log(player.item[item].itemName);
        // }

            try {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setAuthor({ name: `${interaction.user.tag}` })
                    .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                    .setFooter({ text: 'This bot was made by megura.xyz.' })
                    .addFields({name: `**INVENTORY**`, value: `${player.item[0].itemName}\n${player.item[1].itemName}\n${player.item[2].itemName}\n${player.item[3].itemName}\n${player.item[4].itemName}`});

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.log(error);
            }
    }
};