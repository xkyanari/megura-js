const { EmbedBuilder, MessageCollector } = require('discord.js');
const { CaptchaGenerator } = require('captcha-canvas');
const { Guild } = require('../src/db');
const { uploadImage, deleteImage } = require('./upload');

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
    const flag = `captcha_image`;

    const imageURL = await uploadImage(buffer, flag);
    const embed = new EmbedBuilder()
        .setTitle('Verification')
        .setDescription(`Please complete the CAPTCHA by entering the code in the channel. Don't worry about upper or lower case letters.`)
        .setImage(imageURL);

    let isVerified = false;
    const captchaMessage = await interaction.reply({ embeds: [embed], ephemeral: true });

    const collector = new MessageCollector(channel, { time: 180000 });
    collector.on('collect', async collectedMessage => {
        if (collectedMessage.author.id !== member.id) return;
        if (collectedMessage.content.toLowerCase() === captcha.text.toLowerCase()) {
            const addRole = guild.roles.cache.get(guildCheck.verifyRoleID);
            await member.roles.add(addRole);
            if (captchaMessage) {
                try {
                  await captchaMessage.delete();
                } catch (error) {
                  if (error.code !== 10008) {
                    console.error('Error deleting captchaMessage:', error);
                  }
                }
            }
            await deleteImage(flag);
            await interaction.followUp({ content: `You have been successfully verified!`, ephemeral: true });
            isVerified = true;
            collector.stop();
        } else {
            await interaction.followUp({ content: `The captcha code you entered is incorrect. Please try again.`, ephemeral: true });
        }
    });

    collector.on('end', async () => {
        if (!isVerified) {
            if (captchaMessage) await captchaMessage.delete();
            await deleteImage(flag);
            await interaction.followUp({ content: `The verification process has timed out. Please try again.`, ephemeral: true });
        }
    });
};