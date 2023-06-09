const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const buttonPages = require('../../functions/paginator');
const { Contract } = require('../../src/db');
const logger = require('../../src/logger');

const createEmbedPages = async () => {
	try {
		const contracts = await Contract.findAll();
		const embedPages = [];

		const contractsByBlockchain = {};
		contracts.forEach((contract) => {
			if (!contractsByBlockchain[contract.blockchain]) {
				contractsByBlockchain[contract.blockchain] = [];
			}
			contractsByBlockchain[contract.blockchain].push(contract);
		});

		const totalPageCount = Object.values(contractsByBlockchain).reduce(
			(total, contractName) => {
				return total + Math.ceil(contractName.length / 10);
			},
			0,
		);

		for (const blockchain in contractsByBlockchain) {
			const blockchainContracts = contractsByBlockchain[blockchain];
			const contractGroups = [];
			for (let i = 0; i < blockchainContracts.length; i += 10) {
				contractGroups.push(blockchainContracts.slice(i, i + 10));
			}

			const pages = contractGroups.map((contractsGroup, index) => {
				const blockchainName =
          blockchain.charAt(0).toUpperCase() + blockchain.slice(1);
				const pageNumber = index + 1;
				const embed = new EmbedBuilder()
					.setTitle(
						`Supported Collections (${blockchainName}) - Page ${index + 1}`,
					)
					.setFooter({ text: `Page ${pageNumber} / ${totalPageCount}` });

				contractsGroup.forEach((contract) => {
					embed.addFields({
						name: `🔸${contract.contractName}`,
						value: contract.collectionURL,
						inline: false,
					});
				});

				return embed;
			});

			embedPages.push(...pages);
		}

		return embedPages;
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('collections')
		.setDescription('List of supported collections'),
	cooldown: 3000,
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		await interaction.deferReply();

		const embedPages = await createEmbedPages();

		buttonPages(interaction, embedPages);
	},
};
