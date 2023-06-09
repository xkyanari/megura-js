const {
	EmbedBuilder,
	StringSelectMenuBuilder,
	ActionRowBuilder,
} = require('discord.js');
const { Player, Contract } = require('../../src/db');
const buttonPages = require('../../functions/paginator');

module.exports = {
	data: {
		name: 'collection',
	},
	async execute(interaction) {
		const member = interaction.member;
		const guild = interaction.guild;
		await interaction.deferReply();

		try {
			const selected = await interaction.values[0];

			const { collectionID, contractAddress } = await Contract.findOne({
				where: { contractName: selected },
			});
			const { walletAddress } = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
			});
			await Player.update(
				{ contractAddress },
				{ where: { discordID: member.id, guildID: guild.id } },
			);

			const options = {
				method: 'GET',
				headers: {
					'accept': 'application/json',
					'content-type': 'application/json',
					// 'token': solscanApiToken
				},
			};

			const nftResult = await fetch(
				`https://api-mainnet.magiceden.dev/v2/wallets/${walletAddress}/tokens?offset=0&limit=100&listStatus=unlisted`,
				options,
			);
			const nfts = await nftResult.json();

			const nftList = [];
			const nftOptions = [];
			nfts.forEach((thisNFT) => {
				if (thisNFT.collection === collectionID) {
					if (!nftList.includes(`${thisNFT.name}\n`)) {
						console.log(thisNFT);
						nftList.push(`${thisNFT.name}\n`);
						nftOptions.push({
							label: `${thisNFT.name}`,
							value: `${thisNFT.name}`,
						});
					}
				}
			});
			nftList.sort();
			nftOptions.sort();

			if (nftList.length > 25) {
				const nftListPages = [];
				for (let i = 0; i < nftList.length; i += 25) {
					nftListPages.push(nftList.slice(i, i + 25));
				}

				const optionPages = [];
				for (let i = 0; i < nftOptions.length; i += 25) {
					optionPages.push(nftOptions.slice(i, i + 25));
				}

				const embedPages = nftListPages.map((nftPage) => {
					const embed = new EmbedBuilder()
						.setColor(0xcd7f32)
						.setAuthor({ name: `${interaction.user.tag}` })
						.setThumbnail(
							`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
						)
						.addFields({
							name: selected,
							value: nftPage.join(''),
							inline: false,
						});
					return embed;
				});

				const selectMenu = new StringSelectMenuBuilder()
					.setCustomId('ethereum')
					.setPlaceholder('Please select an NFT.')
					.addOptions(optionPages[0]);

				buttonPages(interaction, embedPages, selectMenu, optionPages);
			}
			else {
				const tokenList = new EmbedBuilder()
					.setColor(0xcd7f32)
					.setAuthor({ name: `${interaction.user.tag}` })
					.setThumbnail(
						`${member.displayAvatarURL({ extension: 'png', size: 512 })}`,
					)
					.addFields({
						name: selected,
						value: nftList.join(''),
						inline: false,
					});

				const menu = new ActionRowBuilder().addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('solana')
						.setPlaceholder('Please select an NFT.')
						.setOptions(nftOptions),
				);

				await interaction.editReply({
					embeds: [tokenList],
					components: [menu],
				});
			}
		}
		catch (error) {
			console.error(error);
		}
	},
};
