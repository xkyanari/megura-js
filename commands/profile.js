const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription("Show a player's profile")
        .addUserOption(option =>
            option
            .setName('player')
            .setDescription('Choose the player you want to check.')
            .setRequired(false)),
            
	async execute(interaction) {
        const getPlayer = interaction.options.getUser('player');
        const member = getPlayer === null ? interaction.user : getPlayer;
        const numFormat = (value) => new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.reply("This user does not have a player profile in this world yet.");

        try {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('**ADVENTURER ID CARD**')
                .setAuthor({ name: `${member.tag}` })
                .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                .addFields(
                    { name: '👤 Player Name', value: `${player.playerName}`, inline: false },
                    { name: '👥 Faction', value: `${player.faction}`, inline: false },
                    { name: '🩸 Health', value: `${player.totalHealth}`, inline: false },
                    { name: '⚔️ Attack', value: `${player.totalAttack}`, inline: true },
                    { name: '🛡️ Defense', value: `${player.totalDefense}`, inline: true },
                    { name: '🗡️ Weapon', value: `${player.weapon}`, inline: false },
                    { name: '💠 Armor', value: `${player.armor}`, inline: false },
                    { name: '💰 Iura', value: `$${numFormat(player.iura.walletAmount)}`, inline: false },
                )
                .setImage(`${player.imageURL}`)
                .setFooter({ text: 'This bot was made by megura.xyz.' });

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.log(error);
        }
	}
};