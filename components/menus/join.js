const { EmbedBuilder } = require('discord.js');
const { Player } = require('../../src/db');
const { Network, Alchemy } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../../config.json');

const settings = {
    apiKey: AlchemyApiKey,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

module.exports = {
    data: {
        name: `join`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const selected = await interaction.values[0];

        const { contractAddress, walletAddress } = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});

        const nfts = await alchemy.nft.getNftMetadata(contractAddress, selected);
        // console.log(nfts);

        const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`${nfts.contract.openSea.collectionName}`)
        .setImage(`${nfts.rawMetadata.image}`);

        if (nfts.contract.openSea.collectionName === 'PXN: Ghost Division') {
            embed.addFields(
                { name: `Token ID:`, value: `${selected}`, inline: false },
                { name: `Weapon:`, value: `${nfts.rawMetadata.attributes[8].value}`, inline: true },
                { name: `Armor:`, value: `${nfts.rawMetadata.attributes[7].value}`, inline: true });
            await Player.update({ weapon: nfts.rawMetadata.attributes[8].value, armor: nfts.rawMetadata.attributes[7].value, walletAddress, tokenID: selected, imageURL: nfts.rawMetadata.image }, { where: { discordID: member.id, guildID: guild.id }});
            await Player.increment({ totalAttack: 200, totalDefense: 200 }, { where: { discordID: member.id, guildID: guild.id }});

        } else if (nfts.contract.openSea.collectionName === 'The Girls of Armament: GENE_SIS') {
            // console.log(nfts.rawMetadata.attributes);
            embed.addFields(
                { name: `Token ID:`, value: `${selected}`, inline: false },
                { name: `Weapon:`, value: `${nfts.rawMetadata.attributes[9].value}`, inline: true },
                { name: `Armor:`, value: `${nfts.rawMetadata.attributes[6].value}`, inline: true });
            await Player.update({ weapon: nfts.rawMetadata.attributes[9].value, armor: nfts.rawMetadata.attributes[6].value, walletAddress, tokenID: selected, imageURL: nfts.rawMetadata.image }, { where: { discordID: member.id, guildID: guild.id }});
            await Player.increment({ totalAttack: 200, totalDefense: 200 }, { where: { discordID: member.id, guildID: guild.id }});
        }

        await interaction.update({
            content: `Your profile has been updated.`,
            embeds: [embed]
        });
        
        // await interaction.update({ content: `\u200b`, embeds: [embed2], components: [] });
        
    }
};