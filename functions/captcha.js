const { AttachmentBuilder, EmbedBuilder, MessageCollector } = require('discord.js');
const { CaptchaGenerator } = require('captcha-canvas');
const { Guild } = require('../src/db');

module.exports = async (interaction) => {
    const { channel, guild, member } = interaction;
    const guildCheck = await Guild.findOne({ where: { guildID: guild.id }});

    if (!guildCheck || !guildCheck.verifyRoleID) return interaction.reply({ content: `The "Verified" role does not exist. Please contact the guild admins.`, ephemeral: true });

    const verifiedRole = member.roles.cache.get(guildCheck.verifyRoleID);
    if (verifiedRole) return interaction.reply({ content: `You're already verified!`, ephemeral: true });

    const captcha = new CaptchaGenerator()
        .setDimension(150, 450)
        .setDecoy({ opacity: 0.5 })
        .setTrace({ color: "deeppink" });
    const buffer = captcha.generateSync();

    const attachment = new AttachmentBuilder(buffer, 'captcha.png');
    const embed = new EmbedBuilder()
        .setTitle('Verification')
        .setDescription('Please complete the captcha by typing the code on the channel to verify yourself.')
        .setImage('attachment://captcha.png');

    let isVerified = false;
    
    const captchaMessage = await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });

    const collector = new MessageCollector(channel, { time: 180000 });
    collector.on('collect', async collectedMessage => {
        if (collectedMessage.author.id !== member.id) return;
        if (collectedMessage.content.toLowerCase() === captcha.text.toLowerCase()) {
            const addRole = guild.roles.cache.get(guildCheck.verifyRoleID);
            await member.roles.add(addRole);
            await collectedMessage.delete();
            if (captchaMessage) {
                try {
                  await captchaMessage.delete();
                } catch (error) {
                  if (error.code !== 10008) { // If the error is not 'Unknown Message', log it
                    console.error('Error deleting captchaMessage:', error);
                  }
                }
            }
            await interaction.followUp({ content: `You have been successfully verified!`, ephemeral: true });
            isVerified = true;
            collector.stop();
        } else {
            await collectedMessage.delete();
            await interaction.followUp({ content: `The captcha code you entered is incorrect. Please try again.`, ephemeral: true });
        }
    });

    collector.on('end', async () => {
        if (!isVerified) {
            if (captchaMessage) {
                try {
                  captchaMessage.delete();
                } catch (error) {
                  if (error.code !== 10008) { // If the error is not 'Unknown Message', log it
                    console.error('Error deleting captchaMessage:', error);
                  }
                }
            }
            interaction.followUp({ content: `The verification process has timed out. Please try again.`, ephemeral: true });
        }
    });
};