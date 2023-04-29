const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { request } = require('undici');
const { Player } = require('../src/db');

GlobalFonts.registerFromPath('./assets/fonts/OldLondon.ttf', 'Old London');

const applyText = (canvas, text, fontFamily = 'sans-serif') => {
    const context = canvas.getContext('2d');
    let fontSize = 70;

    do {
        context.font = `${fontSize -= 10}px ${fontFamily}`;
    } while (context.measureText(text).width > canvas.width - 300);

    return context.font;
};

const applyTextSmall = (canvas, text, fontFamily = 'sans-serif') => {
    const context = canvas.getContext('2d');
    let fontSize = 27;

    do {
        context.font = `${fontSize -= 5}px ${fontFamily}`;
    } while (context.measureText(text).width > canvas.width - 300);

    return context.font;
};

module.exports = async (message) => {
    const player = await Player.findOne({ where: { discordID: message.author.id, guildID: message.guild.id } });

    const canvas = createCanvas(700, 250);
    const context = canvas.getContext('2d');

    const background = await loadImage('./assets/images/levelup.png');
    context.drawImage(background, 0, 0, canvas.width, canvas.height);

    context.lineWidth = 10;
    context.strokeStyle = '#96ABAC';
    context.strokeRect(0, 0, canvas.width, canvas.height);

    const { count: totalPlayers, rows: allPlayers } = await Player.findAndCountAll({
        where: {
            guildID: message.guild.id
        },
        order: [['duelKills', 'DESC']]
    });

    const rank = allPlayers.findIndex(p => p.discordID === player.discordID) + 1;

    context.font = applyText(canvas, `Rank: ${rank}/${totalPlayers}`, 'Old London');
    context.fillStyle = '#6ED4BE';

    // Set the shadow properties
    context.shadowColor = '#000000';
    context.shadowBlur = 10;
    context.shadowOffsetX = 5;
    context.shadowOffsetY = 5;

    // Draw the text with the shadow
    context.fillText(`Rank: ${rank}/${totalPlayers}`, canvas.width - context.measureText(`Rank: ${rank}/${totalPlayers}`).width - 50, canvas.height / 3.25);

    // Reset the shadow properties
    context.shadowColor = 'rgba(0, 0, 0, 0)';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Draw other text elements
    const textYSpacing = 27;
    const textElements = [
        `Player Name: ${player.playerName}`,
        `Level: ${player.level}`,
        `HP: ${player.totalHealth}`,
        `ATK: ${player.totalAttack}`,
        `DEF: ${player.totalDefense}`
    ];

    context.font = applyText(canvas, textElements[0]);
    for (let i = 0; i < textElements.length; i++) {
        context.fillStyle = '#FFFFFF';
        context.font = applyTextSmall(canvas, textElements[i]);
        const textWidth = context.measureText(textElements[i]).width;
        context.fillText(textElements[i], canvas.width - textWidth - 50, canvas.height / 2.25 + i * textYSpacing);
    }

    // Avatar
    context.beginPath();
    context.arc(125, 125, 100, 0, Math.PI * 2, true);
    context.closePath();
    context.clip();

    const { body } = await request(message.author.displayAvatarURL({ extension: 'png', size: 512 }));
    const avatar = await loadImage(await body.arrayBuffer());
    context.drawImage(avatar, 25, 25, 200, 200);

    const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'profile-image.png' });

    await message.channel.send({ files: [attachment] });
};
