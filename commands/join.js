const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('../src/db');
const { Network, Alchemy } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../config.json');

const settings = {
    apiKey: AlchemyApiKey,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('join')
		.setDescription("Link your NFT to your profile here.")
        .addStringOption(option =>
            option
            .setName('wallet')
            .setDescription('Enter your wallet address.')
            .setRequired(true)),

	async execute(interaction) {
        const getWallet = interaction.options.getString('wallet');
        const member = interaction.member;
        const guild = interaction.guild;
        const channel = interaction.channel;

        try {

            const options = {
                contractAddresses: [
                    '0x160c404b2b49cbc3240055ceaee026df1e8497a0', // PXN
<<<<<<< HEAD
                    // '0xd8a5d498ab43ed060cb6629b97a19e3e4276dd9f', TGOA
                    // '0x2da00b0140c52f2321838f9fEF95671d215e07f6', GingerTail's Hidden Secrets
=======
                    // '0xd8a5d498ab43ed060cb6629b97a19e3e4276dd9f',
>>>>>>> 271b663ee27f477bcdb9e6670f6c3fe4369bb79b
                ],
            };
            const nfts = await alchemy.nft.getNftsForOwner(getWallet, options);
            // console.log(nfts.ownedNfts[0]);

            const embed2 = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${nfts.ownedNfts[0].contract.openSea.collectionName}`)
            .addFields(
                { name: `Token ID:`, value: `${nfts.ownedNfts[0].tokenId}`, inline: false },
                { name: `Weapon:`, value: `${nfts.ownedNfts[0].rawMetadata.attributes[8].value}`, inline: true },
                { name: `Armor:`, value: `${nfts.ownedNfts[0].rawMetadata.attributes[7].value}`, inline: true })
            .setImage(`${nfts.ownedNfts[0].rawMetadata.image}`);

            await channel.send({ content: `This is so cool! I don't know much about NFTs, but it looks like a really fun way to get involved with the crypto world.\n\nI'm going to put this to the database now.`, embeds: [embed2] });

            await Player.update({ weapon: nfts.ownedNfts[0].rawMetadata.attributes[8].value, armor: nfts.ownedNfts[0].rawMetadata.attributes[7].value, walletAddress: walletAddress.content, tokenID: nfts.ownedNfts[0].tokenId, imageURL: nfts.ownedNfts[0].rawMetadata.image }, { where: { discordID: member.id, guildID: guild.id }});

        } catch (error) {
            // interaction.reply("This user does not have a player profile in this world yet.");
            console.log(error);
        }
	}
};