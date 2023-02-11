const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('List of Commands'),
	async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🛡️ **COMMANDS:** 🛡️')
            .setDescription(
                '> **_!info_** - Shows this message.\n\n**Profile**\n> **_/start_** - Initiate creating own character.\n> **_/profile <username>_** -  Show profile of a user (blank for self).\n\n**Battle**\n> **_/attack_** - Initiate attack against a random monster within your level.\n> **_/duel_** - Initiate a duel against another player.\n\n**Basics**\n> **_/open <name of channel>_** - Creates a private channel, auto-closes in 15 minutes.\n> **_/close_**  - Closes a portal pre-maturely.'
                );

		await interaction.reply({ embeds: [embed] })
            .catch(console.error);
	}
};