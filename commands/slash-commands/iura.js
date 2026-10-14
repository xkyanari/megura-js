const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { Player, Iura } = require('../../src/db');

async function updateName(interaction, player, type, name) {
	const field = type === 'wallet' ? 'walletName' : 'bankName';
	const label = type === 'wallet' ? 'Wallet' : 'Bank';

	try {
		await Iura.update(
			{ [field]: name },
			{ where: { accountID: player.iura.accountID } },
		);
	}
	catch (error) {
		if (error instanceof UniqueConstraintError) {
			return interaction.editReply(`The name \`${name}\` is already taken.`);
		}
		throw error;
	}

	await interaction.editReply(`${label}: \`${name}\` has been updated successfully.`);
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('iura')
		.setDescription('Manage your funds in your bank or wallet!')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('wallet')
				.setDescription('Manage your wallet.')
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Update the name of your wallet.')
						.setMaxLength(20)
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('deposit')
						.setMinValue(1)
						.setDescription('Deposit funds to the bank.')
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('withdraw')
						.setMinValue(1)
						.setDescription('Withdraw funds from the bank.')
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('bank')
				.setDescription('Manage your bank and savings.')
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Update the name of your bank.')
						.setMaxLength(20)
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('save')
						.setMinValue(1)
						.setDescription('Move IURA from your bank into savings.')
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('take')
						.setMinValue(1)
						.setDescription('Move IURA from savings back to your bank.')
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('balance')
				.setDescription('Check your balance.')
				.addStringOption((option) =>
					option
						.setName('view')
						.setDescription('Select which balance to view.')
						.setRequired(false)
						.addChoices(
							{ name: 'Wallet', value: 'wallet' },
							{ name: 'Bank', value: 'bank' },
						),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;

		await interaction.deferReply({ flags: 64 });

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
			include: 'iura',
		});

		if (!player) {
			throw new Error('profile not found');
		}

		const balance = player.iura;

		try {
			const numFormat = (value) =>
				new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

			const wallet_name = interaction.options.getString('name');
			const wallet_deposit = interaction.options.getInteger('deposit');
			const wallet_withdraw = interaction.options.getInteger('withdraw');
			const bank_name = interaction.options.getString('name');
			const bank_deposit = interaction.options.getInteger('save');
			const bank_withdraw = interaction.options.getInteger('take');
			const check_balance = interaction.options.getString('view') ?? 'wallet';

			const subCommand = interaction.options.getSubcommand();

			switch (subCommand) {
				case 'wallet':
					if (wallet_name) {
						await updateName(
							interaction,
							player,
							interaction.options.getSubcommand(),
							wallet_name,
						);
					}
					else if (wallet_deposit) {
						// wallet ----> bank
						if (wallet_deposit > balance.walletAmount) {
							return interaction.editReply({
								content: 'You do not have sufficient balance!',
							});
						}

						await player.deposit(wallet_deposit, 'wallet');

						const embed = new EmbedBuilder()
							.setTitle('Deposited.')
							.setDescription(
								`**$${numFormat(wallet_deposit)} IURA** has been deposited to \`${balance.bankName
								}\` account.`,
							);
						await interaction.editReply({ embeds: [embed] });
					}
					else if (wallet_withdraw) {
						// bank ----> wallet
						if (wallet_withdraw > balance.bankAmount) {
							return interaction.editReply({
								content: 'You do not have sufficient balance!',
							});
						}

						await player.withdraw(wallet_withdraw, 'bank');

						const embed = new EmbedBuilder()
							.setTitle('Withdrawn.')
							.setDescription(
								`**$${numFormat(
									wallet_withdraw,
								)} IURA** has been removed from \`${balance.bankName}\` account.`,
							);
						await interaction.editReply({ embeds: [embed] });
					}
					else {
						const embed = new EmbedBuilder()
							.setTitle('Error!')
							.setDescription(
								'Please deposit and withdraw from your wallet balance only. Thanks!',
							);
						await interaction.editReply({ embeds: [embed] });
					}
					break;

				case 'bank':
					if (bank_name) {
						await updateName(
							interaction,
							player,
							interaction.options.getSubcommand(),
							bank_name,
						);
					}
					else if (bank_deposit) {
						// bank ----> savings
						if (bank_deposit > balance.bankAmount) {
							return interaction.editReply({
								content: 'You do not have sufficient balance!',
							});
						}

						await player.deposit(bank_deposit, 'bank');

						const embed1 = new EmbedBuilder()
							.setTitle('Saved.')
							.setDescription(
								`**$${numFormat(
									bank_deposit,
								)} IURA** has been added to your savings.`,
							);
						await interaction.editReply({ embeds: [embed1] });
					}
					else if (bank_withdraw) {
						// savings ----> bank
						if (bank_withdraw > balance.stakedAmount) {
							return interaction.editReply({
								content: 'You do not have sufficient balance!',
							});
						}

						await player.withdraw(bank_withdraw, 'stake');

						const embed1 = new EmbedBuilder()
							.setTitle('Withdrawn.')
							.setDescription(
								`**$${numFormat(
									bank_withdraw,
								)} IURA** has been moved from your savings to your bank.`,
							);
						await interaction.editReply({ embeds: [embed1] });
					}
					else {
						const embed1 = new EmbedBuilder()
							.setTitle('Error!')
							.setDescription(
								'Please move IURA between your bank and savings only. Thanks!',
							);
						await interaction.editReply({ embeds: [embed1] });
					}
					break;

				case 'balance':
					if (check_balance === 'wallet') {
						const embed2 = new EmbedBuilder()
							.setTitle('Balance')
							.setDescription(
								`💰 **Wallet:** $${numFormat(balance.walletAmount)} IURA`,
							);
						await interaction.editReply({ embeds: [embed2] });
					}
					else if (check_balance === 'bank') {
						const embed2 = new EmbedBuilder()
							.setTitle('Balance')
							.setDescription(
								`🏦 **Bank:** $${numFormat(
									balance.bankAmount,
								)} IURA\n💵 **Savings:** $${numFormat(balance.stakedAmount)} IURA`,
							);
						await interaction.editReply({ embeds: [embed2] });
					}
					break;
			}
		}
		catch (error) {
			// balance changed between the check above and the update
			if (error.message === 'insufficient funds') {
				return interaction.editReply('You do not have sufficient balance!');
			}
			throw error;
		}
	},
};
