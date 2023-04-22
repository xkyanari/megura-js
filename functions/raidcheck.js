const { EmbedBuilder } = require('discord.js');
const { Raid } = require('../src/db');

module.exports = async (interaction, tweetUrlId) => {
    const raids = await Raid.findAll({ where: { tweetUrlId }});

    const retweeterIDs = [];
    const likerIDs = [];

    raids.forEach((raid) => {
        retweeterIDs.push(...raid.retweeters);
        likerIDs.push(...raid.likers);
    });

    const uniqueRetweeterIDs = [...new Set(retweeterIDs)];
    const uniqueLikerIDs = [...new Set(likerIDs)];
    const retweeters = await Promise.all(uniqueRetweeterIDs.map((id) => interaction.client.users.fetch(id)));
    const likers = await Promise.all(uniqueLikerIDs.map((id) => interaction.client.users.fetch(id))); 

    const embed = new EmbedBuilder()
        .setTitle('RT & Like Users')
        .setColor(0x0099ff);

    const retweetersString = retweeters.map((user) => `<@${user.id}>`).join(' ');
    const likersString = likers.map((user) => `<@${user.id}>`).join(' ');

    embed.setDescription(`**🐦 Retweets:**\n${retweetersString}\n\n**❤️ Likes:**\n${likersString}`);

    await interaction.reply({ embeds: [embed] });
};