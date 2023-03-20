const { SlashCommandBuilder } = require('discord.js');
const { Player, Iura, Item } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reset')
		.setDescription('Remove a voyager profile.')
        .addUserOption(option =>
            option
            .setName('player')
            .setDescription('Select a player.')
            .setRequired(true))
        .setDefaultMemberPermissions('0'),
    cooldown: 3000,
	async execute(interaction) {
        const member = interaction.options.getUser('player');
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });
        if (player) {
            await Item.destroy({ where: { accountID: player.iura.accountID }});
            await Iura.destroy({ where: { accountID: player.iura.accountID }});
            await Player.destroy({ where: { discordID: member.id, guildID: guild.id }});
        }

		await interaction.reply({ content: `\`${member.tag}\` profile has been removed.`});
	}
};