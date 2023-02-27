const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('List of Commands'),
    cooldown: 3000,
	async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🛡️ **COMMANDS:** 🛡️')
            .setDescription(
                '> **_/info_** - Shows this message.\n\n**Profile**\n> **_/start_** - Initiate creating own character.\n> **_/profile <username>_** -  Show profile of a user (blank for self).\n> **_/changenick_** -  Updates player name.\n> **_/join_** -  Adds your NFT to your player profile.\n\n**Quests**\n> **_/daily_** - Do a random quest to increase/decrease stats or gain Iura.\n\n**Battle**\n> **_/attack_** - Initiate attack against a random monster.\n> **_/duel_** - Initiate a duel against another player.\n\n**Basics**\n> **_/open <name of channel>_** - Creates a private channel, auto-closes in 10 minutes.\n> **_/close_**  - Closes a portal pre-maturely.\n> **_/iura_**  - Check your wallet or bank.\n> **_/shop_**  - Opens the Item Shop.\n> **_/inventory_**  - Opens your inventory.'
                );

		await interaction.reply({ embeds: [embed] });
	}
};