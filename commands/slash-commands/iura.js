const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Iura } = require('../../src/db');
const logger = require('../../src/logger');
const { checkProfile } = require('../../src/vars');

async function updateName(interaction, player, type, name) {
	if (type === 'wallet') {
		Iura.update(
			{ walletName: name },
			{ where: { accountID: player.iura.accountID } },
		)
			.then(() => Iura.findOne({ where: { accountID: player.iura.accountID } }))
			.then((create_wallet) =>
				interaction.reply(
					`Wallet: \`${create_wallet.walletName}\` has been updated successfully.`,
				),
			);
	}
	else {
		Iura.update(
			{ bankName: name },
			{ where: { accountID: player.iura.accountID } },
		)
			.then(() => Iura.findOne({ where: { accountID: player.iura.accountID } }))
			.then((create_bank) =>
				interaction.reply(
					`Bank: \`${create_bank.bankName}\` has been updated successfully.`,
				),
			);
	}
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
						.setDescription('Deposit funds to the bank.')
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('withdraw')
						.setDescription('Withdraw funds from the bank.')
						.setRequired(false),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('bank')
				.setDescription('Manage your bank or stake/unstake funds.')
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Update the name of your bank.')
						.setMaxLength(20)
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('stake')
						.setDescription('Stake your funds in the bank.')
						.setRequired(false),
				)
				.addIntegerOption((option) =>
					option
						.setName('unstake')
						.setDescription('Unstake funds from the bank.')
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

		logger.log({
			level: 'info',
			message: `User: ${member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		try {
			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
				include: 'iura',
			});
			const balance = await player.balance();

			if (!player) {
				return interaction.reply({
					content: checkProfile,
					ephemeral: true,
				});
			}

			const numFormat = (value) =>
				new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

			const wallet_name = interaction.options.getString('name');
			const wallet_deposit = interaction.options.getInteger('deposit');
			const wallet_withdraw = interaction.options.getInteger('withdraw');
			const bank_name = interaction.options.getString('name');
			const bank_deposit = interaction.options.getInteger('stake');
			const bank_withdraw = interaction.options.getInteger('unstake');
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
					if (wallet_deposit) {
						// wallet ----> bank
						if (wallet_deposit > balance.walletAmount) {
							return interaction.reply({
								content: 'You do not have sufficient balance!',
								ephemeral: true,
							});
						}

						await player.deposit(
							wallet_deposit,
							interaction.options.getSubcommand(),
						);

						const embed = new EmbedBuilder()
							.setTitle('Deposited.')
							.setDescription(
								`**$${numFormat(wallet_deposit)} IURA** has been deposited to \`${balance.bankName
								}\` account.`,
							);
						await interaction
							.reply({ embeds: [embed], ephemeral: true })
							.catch(console.error);
					}
					if (wallet_withdraw) {
						// bank ----> wallet
						if (wallet_withdraw > balance.bankAmount) {
							return interaction.reply({
								content: 'You do not have sufficient balance!',
								ephemeral: true,
							});
						}

						await player.withdraw(
							wallet_withdraw,
							interaction.options.getSubcommand(),
						);

						const embed = new EmbedBuilder()
							.setTitle('Withdrawn.')
							.setDescription(
								`**$${numFormat(
									wallet_withdraw,
								)} IURA** has been removed from \`${balance.bankName}\` account.`,
							);
						await interaction
							.reply({ embeds: [embed], ephemeral: true })
							.catch(console.error);
					}
					const embed = new EmbedBuilder()
						.setTitle('Error!')
						.setDescription(
							'Please deposit and withdraw from your wallet balance only. Thanks!',
						);
					await interaction.reply({ embeds: [embed], ephemeral: true });
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
					if (bank_deposit) {
						// bank ----> stake
						if (bank_deposit > balance.bankAmount) {
							return interaction.reply({
								content: 'You do not have sufficient balance!',
								ephemeral: true,
							});
						}

						await player.deposit(
							bank_deposit,
							interaction.options.getSubcommand(),
						);

						const embed1 = new EmbedBuilder()
							.setTitle('Staked.')
							.setDescription(
								`**$${numFormat(
									bank_deposit,
								)} IURA** has been added to your Stake account.`,
							);
						await interaction
							.reply({ embeds: [embed1], ephemeral: true })
							.catch(console.error);
					}
					if (bank_withdraw) {
						// stake ----> bank
						if (bank_withdraw > balance.stakedAmount) {
							return interaction.reply({
								content: 'You do not have sufficient balance!',
								ephemeral: true,
							});
						}

						await player.withdraw(
							bank_withdraw,
							interaction.options.getSubcommand(),
						);

						const embed1 = new EmbedBuilder()
							.setTitle('Withdrawn.')
							.setDescription(
								`**$${numFormat(
									bank_withdraw,
								)} IURA** has been removed from your Stake account.`,
							);
						await interaction
							.reply({ embeds: [embed1], ephemeral: true })
							.catch(console.error);
					}
					const embed1 = new EmbedBuilder()
						.setTitle('Error!')
						.setDescription(
							'Please stake and unstake from your bank balance only. Thanks!',
						);
					await interaction.reply({ embeds: [embed1], ephemeral: true });
					break;

				case 'balance':
					if (check_balance === 'wallet') {
						const embed2 = new EmbedBuilder()
							.setTitle('Balance')
							.setDescription(
								`💰 **Wallet:** $${numFormat(balance.walletAmount)} IURA`,
							);
						await interaction
							.reply({ embeds: [embed2], ephemeral: true })
							.catch(console.error);
					}
					if (check_balance === 'bank') {
						const embed2 = new EmbedBuilder()
							.setTitle('Balance')
							.setDescription(
								`🏦 **Bank:** $${numFormat(
									balance.bankAmount,
								)} IURA\n💵 **Staked:** $${numFormat(balance.stakedAmount)} IURA`,
							);
						await interaction
							.reply({ embeds: [embed2], ephemeral: true })
							.catch(console.error);
					}
					break;
			}
		}
		catch (error) {
			console.error(error);
		}
	},
};
