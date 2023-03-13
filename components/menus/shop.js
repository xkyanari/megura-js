const { Player, Shop } = require('../../src/db');

module.exports = {
    data: {
        name: `shop`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const selected = await interaction.values[0];
        await interaction.deferReply();

        try {
            const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });
            const { price } = await Shop.findOne({ where: { itemName: selected } });

            if (!player) return interaction.editReply("This user does not have a player profile in this world yet.");
            if (price > player.iura.walletAmount) return interaction.editReply(`You do not have sufficient balance!`);

            await player.withdraw(-price);
            await player.addItem(selected);
            await player.updateStats(selected);
            await Player.increment({ iuraSpent: price }, { where: { discordID: member.id }});

            await interaction.editReply(`\`${selected}\` has been purchased.`);

        } catch (error) {
            console.log(error);
        }
    }
};