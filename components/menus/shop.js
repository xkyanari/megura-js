const { Player, Iura } = require('../../src/db');

module.exports = {
    data: {
        name: `shop-menu`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        const selected = await interaction.values[0];
        // const wait = require('node:timers/promises').setTimeout;
        await interaction.deferReply();
        // await wait(3 * 1000);

        // const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (selected === 'basic_sword') {
            // await Iura.decrement({ where: { accountID: player.iura.accountID }});
            await interaction.editReply(`\`Basic Sword\` has been purchased.`);
        } else if (selected === 'cheap_bow') {
            await interaction.editReply(`\`Cheap Bow\` has been purchased.`);
        } else if (selected === 'rotten_bandage') {
            await interaction.editReply(`\`Rotten Bandage\` has been purchased.`);
        } else if (selected === 'boiled_egg') {
            await interaction.editReply(`\`Boiled Egg\` has been purchased.`);
        } else if (selected === 'rock') {
            await interaction.editReply(`\`Simple Rock\` has been purchased.`);
        }
    }
};