const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Iura } = require('../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('iura')
		.setDescription('Manage your funds in your bank or wallet!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('wallet')
                .setDescription('Manage your wallet.')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Update the name of your wallet.')
                        .setMaxLength(20)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option
                        .setName('deposit')
                        .setDescription('Deposit funds to the bank.')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option
                        .setName('withdraw')
                        .setDescription('Withdraw funds from the bank.')
                        .setRequired(false))
            )
        .addSubcommand(subcommand =>
            subcommand
                .setName('bank')
                .setDescription('Manage your bank or stake/unstake funds.')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Update the name of your bank.')
                        .setMaxLength(20)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option
                        .setName('stake')
                        .setDescription('Stake your funds in the bank.')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option
                        .setName('unstake')
                        .setDescription('Unstake funds from the bank.')
                        .setRequired(false))
            )
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Check your balance.')
                .addStringOption(option =>
                    option
                        .setName('view')
                        .setDescription('Select which balance to view.')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Wallet', value: 'wallet' },
                            { name: 'Bank', value: 'bank' }
                        ))
            ),

	async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        
        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });
        const numFormat = (value) => new Intl.NumberFormat('en-US').format(value === null ? 0 : value);

        const wallet_name = interaction.options.getString('name');
        const wallet_deposit = interaction.options.getInteger('deposit');
        const wallet_withdraw = interaction.options.getInteger('withdraw');
        const bank_name = interaction.options.getString('name');
        const bank_deposit = interaction.options.getInteger('stake');
        const bank_withdraw = interaction.options.getInteger('unstake');
        const check_balance = interaction.options.getString('view') ?? 'wallet';
        
        if (interaction.options.getSubcommand() === 'wallet') {
            if (wallet_name) {
                // player.createIura({ walletName: wallet_name })
                Iura.update({ walletName: wallet_name }, { where: { accountID: player.iura.accountID } })
                    .then(() => { return Iura.findOne({ where: { accountID: player.iura.accountID } })})
                    .then((create_wallet) => interaction.reply(`Wallet: \`${create_wallet.walletName}\` has been updated successfully.`));
            }
            else if (wallet_deposit) {
                // wallet ----> bank
                Iura.decrement({ walletAmount: wallet_deposit }, { where: { accountID: player.iura.accountID } })
                    .then(() => { Iura.increment({ bankAmount: wallet_deposit }, { where: { accountID: player.iura.accountID } }) })
                    .then(() => { return Iura.findOne({ where: { accountID: player.iura.accountID } })})
                    .then((update) => {
                        const valueWallet = numFormat(update.walletAmount);
                        const valueBank = numFormat(update.bankAmount);
                        const valueStaked = numFormat(update.stakedAmount);
                        const embed = new EmbedBuilder()
                            .setTitle('Deposited.')
                            .setDescription(
                                `**$${wallet_deposit} IURA** has been deposited to \`${update.bankName}\` account.\n\n💰 **Wallet:** $${valueWallet} IURA\n🏦 **Bank:** $${valueBank} IURA\n💵 **Staked:** $${valueStaked} IURA`);
                        interaction.reply({ embeds: [embed] })
                            .catch(console.error);
                    });
                    
            }
            else {
                // bank ----> wallet
                Iura.decrement({ bankAmount: wallet_withdraw }, { where: { accountID: player.iura.accountID } })
                    .then(() => { Iura.increment({ walletAmount: wallet_withdraw }, { where: { accountID: player.iura.accountID } }) })
                    .then(() => { return Iura.findOne({ where: { accountID: player.iura.accountID } })})
                    .then((update) => {
                        const valueWallet = numFormat(update.walletAmount);
                        const valueBank = numFormat(update.bankAmount);
                        const valueStaked = numFormat(update.stakedAmount);
                        const embed = new EmbedBuilder()
                            .setTitle('Withdrawn.')
                            .setDescription(
                                `**$${wallet_withdraw} IURA** has been withdrawn from \`${update.bankName}\` account.\n\n💰 **Wallet:** $${valueWallet} IURA\n🏦 **Bank:** $${valueBank} IURA\n💵 **Staked:** $${valueStaked} IURA`);
                        interaction.reply({ embeds: [embed] })
                            .catch(console.error);
                    });
            }
        }
        else if (interaction.options.getSubcommand() === 'bank') {
            if (bank_name) {
                Iura.update({ bankName: bank_name }, { where: { accountID: player.iura.accountID } })
                    .then(() => { return Iura.findOne({ where: { accountID: player.iura.accountID } })})
                    .then((create_bank) => interaction.reply(`Bank: \`${create_bank.bankName}\` has been updated successfully.`));
            }
            else if (bank_deposit) {
                // bank ----> stake
                Iura.decrement({ bankAmount: bank_deposit }, { where: { accountID: player.iura.accountID } })
                    .then(() => { Iura.increment({ stakedAmount: bank_deposit }, { where: { accountID: player.iura.accountID } }) })
                    .then(() => { return Iura.findOne({ where: { accountID: player.iura.accountID } })})
                    .then((update) => {
                        const valueWallet = numFormat(update.walletAmount);
                        const valueBank = numFormat(update.bankAmount);
                        const valueStaked = numFormat(update.stakedAmount);
                        const embed = new EmbedBuilder()
                            .setTitle('Staked.')
                            .setDescription(
                                `**$${bank_deposit} IURA** has been added to your Stake account.\n\n💰 **Wallet:** $${valueWallet} IURA\n🏦 **Bank:** $${valueBank} IURA\n💵 **Staked:** $${valueStaked} IURA`);
                        interaction.reply({ embeds: [embed] })
                            .catch(console.error);
                    });
            }
            else {
                // stake ----> bank
                Iura.decrement({ stakedAmount: bank_withdraw }, { where: { accountID: player.iura.accountID } })
                    .then(() => { Iura.increment({ bankAmount: bank_withdraw }, { where: { accountID: player.iura.accountID } }) })
                    .then(() => { return Iura.findOne({ where: { accountID: player.iura.accountID } })})
                    .then((update) => {
                        const valueWallet = numFormat(update.walletAmount);
                        const valueBank = numFormat(update.bankAmount);
                        const valueStaked = numFormat(update.stakedAmount);
                        const embed = new EmbedBuilder()
                            .setColor(0x0099FF)
                            .setTitle('Unstaked.')
                            .setDescription(
                                `**$${bank_withdraw} IURA** has been withdrawn from your Stake account.\n\n💰 **Wallet:** $${valueWallet} IURA\n🏦 **Bank:** $${valueBank} IURA\n💵 **Staked:** $${valueStaked} IURA`);
                        interaction.reply({ embeds: [embed] })
                            .catch(console.error);
                    });
            }
        }
        else if (interaction.options.getSubcommand() === 'balance') {
            if (check_balance === 'wallet') {
                const balanceWallet = numFormat(player.iura.walletAmount);
                const embed = new EmbedBuilder()
                    .setTitle('Balance')
                    .setDescription(`💰 **Wallet:** $${balanceWallet} IURA`);
                await interaction.reply({ embeds: [embed] })
                    .catch(console.error);
            }
            else if (check_balance === 'bank') {
                const balanceBank = numFormat(player.iura.bankAmount);
                const balanceStaked = numFormat(player.iura.stakedAmount);
                const embed = new EmbedBuilder()
                        .setTitle('Balance')
                        .setDescription(`🏦 **Bank:** $${balanceBank} IURA\n💵 **Staked:** $${balanceStaked} IURA`);
                await interaction.reply({ embeds: [embed] })
                    .catch(console.error);
            }
        }
	}
};