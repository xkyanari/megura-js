const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Player, Contract } = require('../../src/db');
const { Network, Alchemy } = require('alchemy-sdk');
const { AlchemyApiKey } = require('../../config.json');
const weapons = require('../../assets/weapons.json');
const armors = require('../../assets/armors.json');

const settings = {
    apiKey: AlchemyApiKey,
    network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(settings);

module.exports = {
    data: {
        name: `ethereum`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const selected = await interaction.values[0];

        const { contractAddress, walletAddress } = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});
        const { traitWeapon, traitArmor } = await Contract.findOne({ where: { contractAddress }});
        
        const weapon = weapons[Math.floor(Math.random()*weapons.length)];
        const armor = armors[Math.floor(Math.random()*armors.length)];

        const nfts = await alchemy.nft.getNftMetadata(contractAddress, selected);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`${nfts.contract.openSea.collectionName}`)
            .setImage(`${nfts.rawMetadata.image}`);

        const weaponValue = nfts.rawMetadata.attributes.find(item => item.trait_type === traitWeapon)?.value ?? weapon;
        const armorValue = nfts.rawMetadata.attributes.find(item => item.trait_type === traitArmor)?.value ?? armor;

        embed.addFields(
            { name: `Token ID:`, value: `${selected}`, inline: false },
            { name: `Weapon:`, value: `${weaponValue}`, inline: true },
            { name: `Armor:`, value: `${armorValue}`, inline: true }
            );

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setEmoji('✅')
                    .setLabel('Update')
                    .setStyle(ButtonStyle.Success)
            );

        await interaction.reply({
            embeds: [embed],
            components: [button]
        });

        interaction.client.userData.set(interaction.user.id, {
            weapon: weaponValue,
            armor: armorValue,
            walletAddress: walletAddress,
            tokenID: selected,
            imageURL: nfts.rawMetadata.image,
        });
    }
};