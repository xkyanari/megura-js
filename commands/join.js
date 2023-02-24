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
    cooldown: 3000,
	async execute(interaction) {
        const getWallet = interaction.options.getString('wallet');
        const member = interaction.member;
        const guild = interaction.guild;

        await interaction.deferReply();

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});

        if (!player) return interaction.editReply("This user does not have a player profile in this world yet.");

            try {
                await Player.update({ walletAddress: getWallet }, { where: { discordID: member.id, guildID: guild.id }});

                const options = {
                    contractAddresses: [
                        '0x160c404b2b49cbc3240055ceaee026df1e8497a0', // PXN
                        '0xd8a5d498ab43ed060cb6629b97a19e3e4276dd9f', // TGOA
                        // '0xa698b4de86e27be81f6deb2efaf98b4a010cfd0f', // Capsule House
                        // '0x2da00b0140c52f2321838f9fEF95671d215e07f6', // GingerTail's Hidden Secrets
                    ],
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

                // if (collectionList.length === '0') return interaction.reply({ content: `You do not have a supported NFT from my list.`, ephemeral: true });

                projectList.addFields({ name: `List of Supported NFT Collections`, value: collectionList.join(''), inline: false });

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
                    // fetchReply: true
                });

            } catch (error) {
                console.log(error);
            }
	}
};