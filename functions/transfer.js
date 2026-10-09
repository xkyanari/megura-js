const { userMention } = require('discord.js');
const { Player, transferIura } = require('../src/db');

const numFormat = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);

/**
 * Sends IURA from the interaction's member to `recipient` (a User) in the same guild.
 */
const transferToPlayer = async (interaction, recipient, amount) => {
	const { member, guild } = interaction;

	if (!Number.isSafeInteger(amount) || amount <= 0) {
		return interaction.reply({ content: 'Please enter an amount of at least 1.', flags: 64 });
	}

	if (member.id === recipient.id) {
		return interaction.reply({ content: 'You can\'t transfer money to yourself!', flags: 64 });
	}

	await interaction.deferReply();

	const players = await Player.findAll({
		where: { discordID: [member.id, recipient.id], guildID: guild.id },
	});
	const sender = players.find((p) => p.discordID === member.id);
	const receiver = players.find((p) => p.discordID === recipient.id);

	if (!sender) {
		throw new Error('profile not found');
	}
	if (!receiver) {
		return interaction.editReply(`${recipient.tag} does not have a voyager profile yet.`);
	}

	try {
		await transferIura(sender.accountID, receiver.accountID, amount);
	}
	catch (error) {
		if (error.message === 'insufficient funds') {
			return interaction.editReply('You do not have sufficient balance!');
		}
		throw error;
	}

	return interaction.editReply(
		`\`${numFormat(amount)} IURA\` has been transferred to ${userMention(receiver.discordID)}.`,
	);
};

module.exports = { transferToPlayer };
