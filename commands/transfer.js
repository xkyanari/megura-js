const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('transfer')
		.setDescription('Buy items in bulk')
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
        const member = interaction.member;
        const guild = interaction.guild;
        const recipient = interaction.options.getUser('player');
        const amount = interaction.options.getInteger('amount');

        console.log(recipient);

        const player1 = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});
        const player2 = await Player.findOne({ where: { discordID: recipient.id, guildID: guild.id }});

        if (!player1 || !player2) return interaction.reply({content: "This user does not have a player profile in this world yet.", ephemeral: true });
        if (amount > player1.iura.walletAmount) return interaction.reply(`You do not have sufficient balance!`);

        await player1.withdraw(-amount);
        await player2.withdraw(amount);

        await interaction.reply(`\`${itemName}\` has been purchased.`);
    }
};