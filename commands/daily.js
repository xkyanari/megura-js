const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Iura } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('daily')
		.setDescription("Complete a daily quest!"),

	async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        // const cooldown = new Set();
        // const cooldownTime = 60000;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });

        if (!player) return interaction.reply("This user does not have a player profile in this world yet.");

            try {
                
                const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setAuthor({ name: `${interaction.user.tag}` })
                    .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                    .setFooter({ text: 'This bot was made by megura.xyz.' })
                    .addFields({name: `**DAILY QUEST**`, value: `\`${player.playerName}\` found a cat searching for food at an alley so they went to a store and gave the cat a can of cat food. The cat was delighted and purred a lot!\n\n✨**Reward:**✨\n- 200 IURA`});
                
                // if (cooldown.has(member.id)) {
                //     interaction.reply({ content: `You received your daily reward today!`, ephemeral: true });
                // } else {
                    await interaction.reply({ embeds: [embed] })
                        .catch(console.error);
                    await Iura.increment({ walletAmount: 200 }, { where: { accountID: player.iura.accountID } });
                //     cooldown.add(member.id);
                //     setTimeout(() => {
                //         cooldown.delete(member.id);
                //     }, cooldownTime);
                // }
            } catch (error) {
                console.log(console.error);
            }
	}
};