const { EmbedBuilder } = require('discord.js');
const { Player, Contract } = require('../src/db');
const { solscanApiToken } = require('../config.json');

module.exports = async (interaction, getWallet, member, guild) => {
	try {
		await Player.update(
			{ walletAddress: getWallet },
			{ where: { discordID: member.id, guildID: guild.id } },
		);

		const contracts = await Contract.findAll({
			where: { blockchain: 'solana' },
		});

		const contractList = [];
		contracts.forEach((collection) => {
			if (!contractList.includes(collection.contractName)) {
				contractList.push(collection.contractName);
			}
		});

		const options = {
			method: 'GET',
			redirect: 'follow',
		};

		const nftResult = await fetch(
			`https://api-mainnet.magiceden.dev/v2/wallets/${getWallet}/tokens?offset=0&limit=100&listStatus=unlisted`,
			options,
		);
		const nfts = await nftResult.json();

		const found = [];
		contractList.forEach((thisCollection) => {
			const foundItem = nfts.find(
				(item) => item.collectionName === thisCollection,
			);
			if (foundItem) {
				found.push(foundItem.collectionName);
			}
		});

		if (found.length === 0) {
			return interaction.editReply({
				content: 'You do not have a supported NFT from my list.',
			});
		}

		const projectList = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setAuthor({ name: `${interaction.user.tag}` })
			.setThumbnail(
				`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
			);

		const collections = [];
		const collectionOptions = [];
		for await (const item of found) {
			const { contractName } = await Contract.findOne({
				where: { contractName: item },
			});

			if (!collections.includes(`${contractName}\n`)) {
				collections.push(`${contractName}\n`);
				collectionOptions.push({
					label: `${contractName}`,
					value: `${contractName}`,
				});
			}
		}
		collections.sort();
		collectionOptions.sort();

		projectList.addFields({
			name: 'List of Supported NFT Collections:',
			value: collections.join(''),
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
							custom_id: 'collection',
							placeholder: 'Please select a collection.',
							options: collectionOptions,
						},
					],
				},
			],
		});

		// await Player.update(
		// 	{ walletAddress: getWallet },
		// 	{ where: { discordID: member.id, guildID: guild.id } },
		// );
		// const contracts = await Contract.findAll({
		// 	where: { blockchain: 'solana' },
		// });

		// const contractList = [];
		// contracts.forEach((collection) => {
		// 	if (!contractList.includes(collection.contractAddress)) {
		// 		contractList.push(collection.contractAddress);
		// 	}
		// });

		// const options = {
		// 	method: 'GET',
		// 	headers: {
		// 		'accept': 'application/json',
		// 		'content-type': 'application/json',
		// 		'token': solscanApiToken,
		// 	},
		// };

		// const nftResult = await fetch(
		// 	`https://pro-api.solscan.io/v1.0/nft/wallet/list_nft/${getWallet}?history=true`,
		// 	options,
		// );
		// const nfts = await nftResult.json();

		// const found = [];
		// contractList.forEach((thisCollection) => {
		// 	const foundItem = nfts.data.list_nfts.find(
		// 		(item) => item.nft_collection_id === thisCollection && item.stop_hodling_time === '0',
		// 	);
		// 	if (foundItem) {
		// 		found.push(foundItem.nft_collection_id);
		// 	}
		// });

		// if (found.length === 0) {
		// 	return interaction.editReply({
		// 		content: 'You do not have a supported NFT from my list.',
		// 	});
		// }

		// const projectList = new EmbedBuilder()
		// 	.setColor(0xcd7f32)
		// 	.setAuthor({ name: `${interaction.user.tag}` })
		// 	.setThumbnail(
		// 		`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
		// 	);

		// const collections = [];
		// const collectionOptions = [];
		// for await (const item of found) {
		// 	const { contractName } = await Contract.findOne({
		// 		where: { contractAddress: item },
		// 	});

		// 	if (!collections.includes(`${contractName}\n`)) {
		// 		collections.push(`${contractName}\n`);
		// 		collectionOptions.push({
		// 			label: `${contractName}`,
		// 			value: `${contractName}`,
		// 		});
		// 	}
		// }
		// collections.sort();
		// collectionOptions.sort();

		// projectList.addFields({
		// 	name: 'List of Supported NFT Collections:',
		// 	value: collections.join(''),
		// 	inline: false,
		// });

		// await interaction.editReply({
		// 	embeds: [projectList],
		// 	components: [
		// 		{
		// 			type: 1,
		// 			components: [
		// 				{
		// 					type: 3,
		// 					custom_id: 'collection',
		// 					placeholder: 'Please select a collection.',
		// 					options: collectionOptions,
		// 				},
		// 			],
		// 		},
		// 	],
		// });
	}
	catch (error) {
		console.log(error);
	}
};