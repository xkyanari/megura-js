const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { request } = require('undici');
// const { Player } = require('../src/db');

GlobalFonts.registerFromPath('./assets/fonts/Montserrat-Bold.ttf', 'Montserrat');

module.exports = async (interaction, player1, player2) => {
	try {
		// Background image
		const canvas = createCanvas(480, 270);
		const context = canvas.getContext('2d');

		const background = await loadImage('./assets/images/arena.jpg');
		context.drawImage(background, 0, 0, canvas.width, canvas.height);

		context.lineWidth = 10;
		context.strokeStyle = '#cd7f32';
		context.strokeRect(0, 0, canvas.width, canvas.height);

		context.save();

		// Player 1
		context.beginPath();
		context.arc(129.5, 135.5, 64.5, 0, Math.PI * 2, true);
		context.closePath();
		context.clip();

		const { body: body1 } = await request(
			player1.user.displayAvatarURL(),
		);
		const chunks1 = [];
		for await (const chunk of body1) {
			chunks1.push(chunk);
		}
		const arrayBuffer1 = Buffer.concat(chunks1);
		const avatar1 = await loadImage(arrayBuffer1);

		const imageX1 = 129.5 - 64.5;
		const imageY1 = 135.5 - 64.5;

		context.drawImage(avatar1, imageX1, imageY1, 129, 129);

		context.restore();
		context.save();

		// Caption for Player 1
		context.font = 'bold 20px Montserrat';
		context.fillStyle = '#cd7f32';
		context.textAlign = 'center';

		context.fillText(player1.playerName, 129.5, 220);

		// Player 2
		context.beginPath();
		context.arc(347.5, 135.5, 64.5, 0, Math.PI * 2, true);
		context.closePath();
		context.clip();

		const { body: body2 } = await request(
			player2.user.displayAvatarURL(),
		);
		const chunks2 = [];
		for await (const chunk of body2) {
			chunks2.push(chunk);
		}
		const arrayBuffer2 = Buffer.concat(chunks2);
		const avatar2 = await loadImage(arrayBuffer2);

		const imageX2 = 347.5 - 64.5;
		const imageY2 = 135.5 - 64.5;

		context.filter = 'grayscale(100%)';
		context.drawImage(avatar2, imageX2, imageY2, 129, 129);
		context.filter = 'none';

		context.restore();

		// Caption for Player 2
		context.font = 'bold 20px Montserrat';
		context.fillStyle = '#cd7f32';
		context.textAlign = 'center';

		context.fillText(player2.playerName, 348.5, 220);

		context.save();

		const attachment = new AttachmentBuilder(await canvas.encode('png'), {
			name: 'arena-image.png',
		});

		await interaction.channel.send({ files: [attachment] });
	}
	catch (error) {
		console.error(error);
	}
};
