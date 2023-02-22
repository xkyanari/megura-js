const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `confirm`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        
        await Player.increment({ totalAttack: 200, totalDefense: 200 }, { where: { discordID: member.id, guildID: guild.id }});

        await interaction.reply({ content: `Your NFT has been linked successfully!`});
    }
};