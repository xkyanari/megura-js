const { EmbedBuilder } = require('discord.js');
const { Player, Contract } = require('../../src/db');
const { Network, Alchemy } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../../config.json');

const settings = {
    apiKey: AlchemyApiKey,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

module.exports = {
    data: {
        name: `contract`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        await interaction.deferReply();
                
        const selected = await interaction.values[0];

        const { contractAddress } = await Contract.findOne({ where: { contractName: selected }});
        const { walletAddress } = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});
        await Player.update({ contractAddress }, { where: { discordID: member.id, guildID: guild.id }});

        const options = { contractAddresses: [ contractAddress ] };

        // gets the nfts based from wallet address
        const nfts = await alchemy.nft.getNftsForOwner(walletAddress, options);
        // console.log(nfts);

        const tokenList = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({ name: `${interaction.user.tag}` })
            .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`);
        
        let nftList = [];
        let nftOptions = [];
        nfts.ownedNfts.forEach(collection => {
            let nftToken = collection.title;
            let nftTokenId = collection.tokenId;

            nftList.push(`${nftToken}\n`);
            nftOptions.push({ "label": `${nftToken}`, "value": `${nftTokenId}`});
        });

        tokenList.addFields({ name: selected, value: nftList.join(''), inline: false });

        await interaction.editReply({
            embeds: [tokenList],
            components: [
                {
                    "type": 1,
                    "components": [
                        {
                            "type": 3,
                            "custom_id": "join",
                            "placeholder": "Please select an NFT.",
                            "options": nftOptions
                        },
                    ]
                }
            ]
        });
    }
};