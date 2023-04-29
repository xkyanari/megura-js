const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Player, Contract } = require('../../src/db');
const weapons = require('../../assets/weapons.json');
const armors = require('../../assets/armors.json');

module.exports = {
    data: {
        name: `solana`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const selected = await interaction.values[0];

        const { contractAddress, walletAddress } = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }});
        const { contractName, traitWeapon, traitArmor } = await Contract.findOne({ where: { contractAddress } });
        
        const weapon = weapons[Math.floor(Math.random()*weapons.length)];
        const armor = armors[Math.floor(Math.random()*armors.length)];

        try {
            const options = {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                }
            };

            const nftResult = await fetch(`https://api-mainnet.magiceden.dev/v2/wallets/${walletAddress}/tokens?offset=0&limit=100&listStatus=unlisted`, options);
            const nfts = await nftResult.json();
            const getAddress = nfts.find(item => item.name === selected);
            
            const nftData= await fetch(`https://api-mainnet.magiceden.dev/v2/tokens/${getAddress.mintAddress}`, options);
            const nftInfo = await nftData.json();

            const embed = new EmbedBuilder()
                .setColor(0xCD7F32)
                .setTitle(`${contractName}`)
                .setImage(`${nftInfo.image}`);

            const weaponValue = nftInfo.attributes.find(item => item.trait_type === traitWeapon)?.value ?? weapon;
            const armorValue = nftInfo.attributes.find(item => item.trait_type === traitArmor)?.value ?? armor;

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
                walletAddress,
                tokenID: selected,
                imageURL: nftInfo.image
            });

        } catch (error) {
            console.log(error);
        }
        
    }
};