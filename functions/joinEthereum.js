const { Player, Contract } = require('../src/db');
const { Alchemy, Network } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../config.json');
const { EmbedBuilder } = require('discord.js');

const settings = {
	apiKey: AlchemyApiKey,
	network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

module.exports = async (interaction, getWallet, member, guild) => {
	try {
		await Player.update(
			{ walletAddress: getWallet },
			{ where: { discordID: member.id, guildID: guild.id } },
		);
		const contracts = await Contract.findAll({
			where: { blockchain: 'ethereum' },
		});

		const contractList = [];
		contracts.forEach((collection) => {
			if (!contractList.includes(collection.contractAddress)) {
				contractList.push(collection.contractAddress);
			}
		});

		const options = {
			contractAddresses: contractList,
		};

		// gets the nfts based from wallet address
		const nfts = await alchemy.nft.getNftsForOwner(getWallet, options);
		if (nfts.ownedNfts.length === 0) {
			return interaction.editReply({
				content: 'You do not have a supported NFT from my list.',
				ephemeral: true,
			});
		}

		const projectList = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setAuthor({ name: `${interaction.user.tag}` })
			.setThumbnail(
				`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
			);

		const collectionList = [];
		const collectionOptions = [];
		nfts.ownedNfts.forEach((collection) => {
			const collectionName = collection.contract.openSea.collectionName;
			if (!collectionList.includes(`${collectionName}\n`)) {
				collectionList.push(`${collectionName}\n`);
				collectionOptions.push({
					label: `${collectionName}`,
					value: `${collectionName}`,
				});
			}
		});
		collectionList.sort();
		collectionOptions.sort();

		projectList.addFields({
			name: 'List of Supported NFT Collections:',
			value: collectionList.join(''),
			inline: false,
		});

		await interaction.editReply({
			embeds: [projectList],
			components: [
				{
					type: 1,
					components: [
						{
							type: 3,
							custom_id: 'contract',
							placeholder: 'Please select a collection.',
							options: collectionOptions,
						},
					],
				},
			],
		});
	}
	catch (error) {
		if (error === 400) {
			return interaction.editReply({
				content: 'You\'ve entered an incorrect wallet address.',
				ephemeral: true,
			});
		}
		if (error === 500) {
			return interaction.editReply({
				content: 'I\'m unable to process your request right now.',
				ephemeral: true,
			});
		}

		console.log(error);
	}
};