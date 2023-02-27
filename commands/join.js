const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Contract } = require('../src/db');
const { Network, Alchemy } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../config.json');

const { solscanApiToken } = require('../config.json');
const contract = require('../models/contract');

const settings = {
    apiKey: AlchemyApiKey,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('join')
		.setDescription("Link your NFT to your profile here.")
        .addSubcommand(subcommand =>
            subcommand
                .setName('ethereum')
                .setDescription('Link your Ethereum wallet.')
                .addStringOption(option =>
                    option
                    .setName('wallet')
                    .setDescription('Enter your wallet address.')
                    .setRequired(true))
            )
        .addSubcommand(subcommand =>
            subcommand
                .setName('solana')
                .setDescription('Link your Solana wallet.')
                .addStringOption(option =>
                    option
                    .setName('wallet')
                    .setDescription('Enter your wallet address.')
                    .setRequired(true))
            ),
    cooldown: 3000,
	async execute(interaction) {
        const getWallet = interaction.options.getString('wallet');
        const member = interaction.member;
        const guild = interaction.guild;

        await interaction.deferReply();

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});

        if (!player) return interaction.editReply("This user does not have a player profile in this world yet.");

        if (interaction.options.getSubcommand() === 'ethereum') {
            try {
                await Player.update({ walletAddress: getWallet }, { where: { discordID: member.id, guildID: guild.id }});
                const contracts = await Contract.findAll({ where: { blockchain: 'ethereum' }});
                
                let contractList = [];
                contracts.forEach(collection => {
                    if (!contractList.includes(collection.contractAddress)) {
                        contractList.push(collection.contractAddress);
                    }
                });
    
                const options = {
                    contractAddresses: contractList,
                };
    
                // gets the nfts based from wallet address
                const nfts = await alchemy.nft.getNftsForOwner(getWallet, options);
                if (nfts.ownedNfts.length === 0) return interaction.editReply({ content: `You do not have a supported NFT from my list.`, ephemeral: true });
    
                const projectList = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setAuthor({ name: `${interaction.user.tag}` })
                    .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`);
                
                let collectionList = [];
                let collectionOptions = [];
                nfts.ownedNfts.forEach(collection => {
                    let collectionName = collection.contract.openSea.collectionName;
                    if (!collectionList.includes(`${collectionName}\n`)) {
                        collectionList.push(`${collectionName}\n`);
                        collectionOptions.push({ "label": `${collectionName}`, "value": `${collectionName}`});
                    }
                });
                collectionList.sort();
                collectionOptions.sort();
    
                projectList.addFields({ name: `List of Supported NFT Collections:`, value: collectionList.join(''), inline: false });
    
                await interaction.editReply({
                    embeds: [projectList],
                    components: [
                        {
                            "type": 1,
                            "components": [
                                {
                                "type": 3,
                                "custom_id": "contract",
                                "placeholder": "Please select a collection.",
                                "options": collectionOptions
                                },
                            ]
                        }
                    ],
                });
    
            } catch (error) {
                if (400) return interaction.editReply({ content: `You've entered an incorrect wallet address.`, ephemeral: true});
                if (500) return interaction.editReply({ content: `I'm unable to process your request right now.`, ephemeral: true});

                console.log(error);
            }

        } else if (interaction.options.getSubcommand() === 'solana') {
            try {
                try {
                    await Player.update({ walletAddress: getWallet }, { where: { discordID: member.id, guildID: guild.id }});
                    const contracts = await Contract.findAll({ where: { blockchain: 'solana' }});

                    let contractList = [];
                    contracts.forEach(collection => {
                        if (!contractList.includes(collection.contractAddress)) {
                            contractList.push(collection.contractAddress);
                        }
                    });

                    const options = {
                        method: 'GET',
                        headers: {
                            accept: 'application/json',
                            'content-type': 'application/json',
                            'token': solscanApiToken
                        },
                        // body: JSON.stringify({
                        //     id: 1,
                        //     jsonrpc: '2.0',
                        //     method: 'getBalance'
                        // })
                    };

                    const nftResult = await fetch(`https://pro-api.solscan.io/v1.0/nft/wallet/list_nft/${getWallet}?history=false`, options);
                    const nfts = await nftResult.json();

                    if (nfts.data.list_nfts.length === 0) return interaction.editReply({ content: `You do not have a supported NFT from my list.`});

                    let found = [];
                    contractList.forEach( thisCollection => {
                        const foundItem = nfts.data.list_nfts.find(item => item.nft_collection_id === thisCollection);
                        if (foundItem) {
                            found.push(foundItem.nft_collection_id);
                        }
                    });
        
                    const projectList = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setAuthor({ name: `${interaction.user.tag}` })
                        .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`);
                    
                    let collections = [];
                    let collectionOptions = [];
                    for await (const item of found) {
                        const { contractName } = await Contract.findOne({ where: { contractAddress: item }});
                        
                        if (!collections.includes(`${contractName}\n`)) {
                            collections.push(`${contractName}\n`);
                            collectionOptions.push({ "label": `${contractName}`, "value": `${contractName}`});
                        }

                    }

                    collections.sort();
                    collectionOptions.sort();
        
                    projectList.addFields({ name: `List of Supported NFT Collections:`, value: collections.join(''), inline: false });
        
                    await interaction.editReply({
                        embeds: [projectList],
                        components: [
                            {
                                "type": 1,
                                "components": [
                                    {
                                    "type": 3,
                                    "custom_id": "collection",
                                    "placeholder": "Please select a collection.",
                                    "options": collectionOptions
                                    },
                                ]
                            }
                        ],
                    });
                    
                } catch (SyntaxError) {
                    await Player.update({ walletAddress: getWallet }, { where: { discordID: member.id, guildID: guild.id }});

                    const collectionList = ['galactic_geckos', 'cyberheroez', 'cybervillainz_reborn', 'simpl3r', 'bvdcat'];
    
                    const options = {
                        method: 'GET',
                        redirect: 'follow',
                    };
        
                    const nftResult = await fetch(`https://api-mainnet.magiceden.dev/v2/wallets/${getWallet}/tokens?offset=0&limit=100&listStatus=unlisted`, options);
                    const nfts = await nftResult.json();
                    
                    if (nfts.length === 0) return interaction.editReply({ content: `You do not have a supported NFT from my list.`});

                    let found = [];
                    collectionList.forEach( thisCollection => {
                        const foundItem = nfts.find(item => item.collection === thisCollection);
                        if (foundItem) {
                            found.push(foundItem.collection);
                        }
                    });
        
                    const projectList = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setAuthor({ name: `${interaction.user.tag}` })
                        .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`);
                    
                    let collections = [];
                    let collectionOptions = [];
                    for await (const item of found) {
                        const { contractName } = await Contract.findOne({ where: { collectionID: item }});

                        if (!collections.includes(`${contractName}\n`)) {
                            collections.push(`${contractName}\n`);
                            collectionOptions.push({ "label": `${contractName}`, "value": `${contractName}`});
                            console.log(item);
                        }
                    }

                    console.log(collections);
                    console.log(collectionOptions);
                    collections.sort();
                    collectionOptions.sort();
        
                    projectList.addFields({ name: `List of Supported NFT Collections:`, value: collections.join(''), inline: false });
        
                    await interaction.editReply({
                        embeds: [projectList],
                        components: [
                            {
                                "type": 1,
                                "components": [
                                    {
                                    "type": 3,
                                    "custom_id": "collection",
                                    "placeholder": "Please select a collection.",
                                    "options": collectionOptions
                                    },
                                ]
                            }
                        ],
                    });
                }
            } catch (error) {
                console.log(error);
            }
        }
	}
};