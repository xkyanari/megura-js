const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription("Check what you have in your bag."),
    cooldown: 3000,
	async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'item' });
        const items = await player.getItems();

        if (!player) return interaction.reply("This user does not have a player profile in this world yet.");

            try {
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setAuthor({ name: `${interaction.user.tag}` })
                    .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                    .setTitle('**🛄 INVENTORY LIST**')
                    .setFooter({ text: 'This bot was made by megura.xyz.' });
                
                if (items.length === 0) {
                    embed.addFields({name: `\u200b`, value: `Nothing here!`, inline: false });
                }
                items.forEach(item => {
                    embed.addFields({name: item.itemName, value: `Quantity: ${item.quantity}`, inline: false });
                });

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.log(error);
            }
	}
};