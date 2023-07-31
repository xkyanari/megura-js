const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { User } = require("../../src/db");
const { isTestnet, website, website_testnet } = require('../../config.json');
const { generateId } = require('../../functions/generateId');

module.exports = {
	data: {
		name: 'registerAuction',
		cooldown: 3000,
	},
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });
			const user = await User.findOne({ where: { userGuildId: `${interaction.member.id}-${interaction.guild.id}` } });

			const registrationID = await generateId(10);
			const auctionURL = isTestnet ? `${website_testnet}/connect` : `${website}/connect`;
			const url = `${auctionURL}?id=${registrationID}`;

			if (user) {
				await user.update({ registrationID });
			}
			else {
				const userGuildId = `${interaction.member.id}-${interaction.guild.id}`;
				await User.create({
					registrationID,
					discordID: interaction.member.id,
					guildID: interaction.guild.id,
					userGuildId,
				});
			}

			const button = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setLabel('Register')
					.setStyle(ButtonStyle.Link)
					.setURL(url),
			);

			const embed1 = new EmbedBuilder().setDescription(
				`Please click the button below to connect your wallet.
				Once connected, please allow up to 3 mins to check your status.`,
			);
			await interaction.editReply({
				embeds: [embed1],
				components: [button],
				ephemeral: true,
			});

			setTimeout(() => {
				User.findOne({ where: { discordID: interaction.member.id } })
					.then((user) => {
						if (user.walletAddress !== null) {
							return interaction.followUp({
								content: `You're now connected!`,
								ephemeral: true,
							});
						}
						else {
							interaction.followUp({
								content: 'Please try connecting your wallet again.',
								ephemeral: true,
							});
						}
					})
					.catch((error) => {
						console.error(error);
					});
			}, 180000);

		} catch (error) {
			console.error(error);
		}
	},
};
