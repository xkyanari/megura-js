const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { Player, Contract } = require('../../src/db');
const { solscanApiToken } = require('../../config.json');

module.exports = {
    data: {
        name: `collection`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;
        await interaction.deferReply();
                
        const selected = await interaction.values[0];

        const { collectionID, contractAddress } = await Contract.findOne({ where: { contractName: selected }});
        const { walletAddress } = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});
        await Player.update({ contractAddress }, { where: { discordID: member.id, guildID: guild.id }});

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                // 'token': solscanApiToken
            }
        };

        const nftResult = await fetch(`https://api-mainnet.magiceden.dev/v2/wallets/${walletAddress}/tokens?offset=0&limit=100&listStatus=unlisted`, options);
        const nfts = await nftResult.json();
        
        const tokenList = new EmbedBuilder()
            .setColor(0x0099FF)
            .setAuthor({ name: `${interaction.user.tag}` })
            .setThumbnail(`${member.displayAvatarURL({ extension: 'png', size: 512 })}`);
        
        let nftList = [];
        let nftOptions = [];
        nfts.forEach( thisNFT => {
            if (thisNFT.collection === collectionID) {
                if (!nftList.includes(`${thisNFT.name}\n`)) {
                    nftList.push(`${thisNFT.name}\n`);
                    nftOptions.push({ "label": `${thisNFT.name}`, "value": `${thisNFT.name}`});
                }
            }
        });
        nftList.sort();
        nftOptions.sort();

        tokenList.addFields({ name: selected, value: nftList.join(''), inline: false });

        const menu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('solana')
                    .setPlaceholder('Please select an NFT.')
                    .setOptions(nftOptions)
            );

        await interaction.editReply({
            embeds: [tokenList],
            components: [menu]
        });
    }
};