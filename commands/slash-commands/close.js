const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('close')
		.setDescription('Closes a portal'),
    cooldown: 13000,
	async execute(interaction) {
        const { channel, member } = interaction;

        if (member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            const time = 10;
            const embed = new EmbedBuilder()
                .setColor(0x6E8B3D)
                .setTitle('Consider it done.')
                .setDescription(
                    `This channel will be deleted in \`${time}\` seconds.`,
                    );
            
            await interaction.reply({ embeds: [embed] });
        } else {
            await interaction.reply("You do not have sufficient privileges.");
        }
        setTimeout(() => {
            channel.delete()
              .catch(console.error);
            }, 10000);
    }
};