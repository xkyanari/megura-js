const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('transfer')
		.setDescription('Transfer Iura to another player.')
        .addUserOption(option => option
            .setName('player')
            .setDescription('Select player.')
            .setRequired(true)
        )
        .addIntegerOption(option => option
            .setName('amount')
            .setDescription('Enter amount.')
            .setRequired(true)
        )
        .setDefaultMemberPermissions('0'),
    cooldown: 3000,
	async execute(interaction) {
        const { member, guild } = interaction;
        const numFormat = (value) => new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
        const recipient = interaction.options.getUser('player');
        const amount = interaction.options.getInteger('amount');

        const player1 = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura'});
        const player2 = await Player.findOne({ where: { discordID: recipient.id, guildID: guild.id }, include: 'iura'});

        if (!player1 || !player2) return interaction.reply({ content: "This user does not have a player profile in this world yet.", ephemeral: true });
        if (member.id === recipient.id) return interaction.reply({ content: "You can't transfer money to yourself!", ephemeral: true });
        if (amount > player1.iura.walletAmount) return interaction.reply({ content: `You do not have sufficient balance!`, ephemeral: true });

        await player1.withdraw(-amount);
        await player2.withdraw(amount);

        await interaction.reply(`\`${numFormat(amount)} IURA\` has been transferred to \`${player2.playerName}.\``);
    }
};