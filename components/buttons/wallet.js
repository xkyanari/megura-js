const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `wallet`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        try {
            const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });
            const numFormat = (value) => new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
    
            if (!player) return interaction.reply("This user does not have a player profile in this world yet.");
    
            try {
                const balanceWallet = numFormat(player.iura.walletAmount);
                const embed = new EmbedBuilder()
                    .setAuthor({ name: `${interaction.user.tag}` })
                    .setTitle('Wallet Balance')
                    .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                    .setDescription(`💰 **Wallet:** $${balanceWallet} IURA`);
                await interaction.reply({ embeds: [embed], ephemeral: true })
                    .catch(console.error);
            } catch (error) {
                console.log(error);
            }   
        } catch (error) {
            console.error(error);
        }

    }
};