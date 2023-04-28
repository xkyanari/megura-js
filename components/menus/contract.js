const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { Player, Contract } = require('../../src/db');
const { Network, Alchemy } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../../config.json');
const buttonPages = require('../../functions/paginator');

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
        // const options = {};

        // gets the nfts based from wallet address
        const nfts = await alchemy.nft.getNftsForOwner(walletAddress, options);
        
        let nftList = [];
        let nftOptions = [];
        nfts.ownedNfts.forEach(collection => {
            let nftToken = collection.title;
            let nftTokenId = collection.tokenId;
        
            nftList.push(`${nftToken}\n`);
            nftOptions.push({ "label": `${nftToken}`, "value": `${nftTokenId}`});
        });
        nftList.sort();
        nftOptions.sort();

        if (nftList.length > 25) {
            const nftListPages = [];
            for (let i = 0; i < nftList.length; i+= 25) {
                nftListPages.push(nftList.slice(i, i + 25));
            }
    
            const optionPages = [];
            for (let i = 0; i < nftOptions.length; i += 25) {
                optionPages.push(nftOptions.slice(i, i + 25));
            }
    
            const embedPages = nftListPages.map((nftPage, index) => {
                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setAuthor({ name: `${interaction.user.tag}` })
                    .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                    .addFields({
                        name: selected,
                        value: nftPage.join(''),
                        inline: false
                    });
                return embed;
            });
    
            let selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ethereum')
                .setPlaceholder('Please select an NFT.')
                .addOptions(optionPages[0]);
    
            buttonPages(interaction, embedPages, selectMenu, optionPages);

        } else {
            const tokenList = new EmbedBuilder()
                .setColor(0x0099FF)
                .setAuthor({ name: `${interaction.user.tag}` })
                .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`)
                .addFields({ name: selected, value: nftList.join(''), inline: false });

            const menu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('ethereum')
                        .setPlaceholder('Please select an NFT.')
                        .setOptions(nftOptions)
                );

            await interaction.editReply({
                embeds: [tokenList],
                components: [menu]
            });
        }

    }
};