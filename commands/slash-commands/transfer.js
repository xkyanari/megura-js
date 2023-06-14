const { SlashCommandBuilder, userMention } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('transfer')
		.setDescription('Transfer Iura to another player.')
		.addUserOption((option) =>
			option
				.setName('player')
				.setDescription('Select player.')
				.setRequired(true),
		)
		.addIntegerOption((option) =>
			option.setName('amount').setDescription('Enter amount.').setRequired(true),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
		const recipient = interaction.options.getMember('player');
		const amount = interaction.options.getInteger('amount');

		try {
			if (member.id === recipient.id) {
				return interaction.reply({
					content: 'You can\'t transfer money to yourself!',
					ephemeral: true,
				});
			}

			await interaction.deferReply();

			const players = await Player.findAll({
				where: {
					discordID: [member.id, recipient.id],
					guildID: guild.id,
				},
				include: 'iura',
			});

			let p1Index = players.findIndex((p) => p.discordID === member.id);

			if (p1Index !== 0) {
				[players[0], players[p1Index]] = [players[p1Index], players[0]];
				p1Index = 0;
			}

			const updatedPlayer1 = players[0];
			const updatedPlayer2 = players[1];

			if (!updatedPlayer1) {
				throw new Error('profile not found');
			}
			if (!updatedPlayer2) {
				return await interaction.editReply(`${recipient.user.tag} does not have a voyager profile yet.`);
			}

			if (amount > updatedPlayer1.iura.walletAmount) {
				return interaction.editReply({
					content: 'You do not have sufficient balance!',
					ephemeral: true,
				});
			}

			await updatedPlayer1.withdraw(-amount);
			await updatedPlayer2.withdraw(amount);

			await interaction.editReply(
				`\`${numFormat(amount)} IURA\` has been transferred to ${userMention(updatedPlayer2.discordID)}.`,
			);
		}
		catch (error) {
			console.error(error);
		}
	},
};
