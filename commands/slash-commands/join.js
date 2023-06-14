const { SlashCommandBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const joinEthereum = require('../../functions/joinEthereum');
const joinSolana = require('../../functions/joinSolana');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('join')
		.setDescription('Link your NFT to your profile here.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('ethereum')
				.setDescription('Link your Ethereum wallet.')
				.addStringOption((option) =>
					option
						.setName('wallet')
						.setDescription('Enter your wallet address.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('solana')
				.setDescription('Link your Solana wallet.')
				.addStringOption((option) =>
					option
						.setName('wallet')
						.setDescription('Enter your wallet address.')
						.setRequired(true),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const getWallet = interaction.options.getString('wallet');
		const { member, guild } = interaction;

		const player = await Player.findOne({
			where: { discordID: member.id, guildID: guild.id },
		});

		if (!player) {
			throw new Error('profile not found');
		}

		await interaction.deferReply();

		if (interaction.options.getSubcommand() === 'ethereum') {
			await joinEthereum(interaction, getWallet, member, guild);
		}
		else if (interaction.options.getSubcommand() === 'solana') {
			await joinSolana(interaction, getWallet, member, guild);
		}
	},
};
