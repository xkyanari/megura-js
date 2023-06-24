const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { User } = require("../../src/db");
const { auctionURL } = require('../../config.json');

const generateWalletName = async (length) => {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let walletName = '';
	for (let i = 0; i < length; i++) {
		walletName += charset.charAt(Math.floor(Math.random() * charset.length));
	}
	return walletName;
};

module.exports = {
	data: {
		name: 'registerAuction',
		cooldown: 3000,
	},
	async execute(interaction) {
		try {
			await interaction.deferReply();
			const user = await User.findOne({ where: { discordID: interaction.member.id, guildID: interaction.guild.id } });

			// const embed0 = new EmbedBuilder()
			// 	.setColor(0xcd7f32)
			// 	.setDescription(`You're all set!`);

			// if (user && user.walletAddress) return await interaction.reply({
			// 	embeds: [embed0],
			// 	ephemeral: true,
			// });

			const registrationID = await generateWalletName(10);
			const url = `${auctionURL}?id=${registrationID}`;

			if (user) {
				await user.update({ registrationID });
			}
			else {
				await User.create({
					registrationID,
					discordID: interaction.member.id,
					guildID: interaction.guild.id,
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
