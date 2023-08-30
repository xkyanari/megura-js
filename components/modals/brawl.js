const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, userMention } = require('discord.js');
const { Brawl, Player, Guild } = require('../../src/db');
const { generateId } = require('../../functions/generateId');
const { isTestnet } = require('../../config.json');

module.exports = {
	data: {
		name: 'brawl-register',
	},
	async execute(interaction) {
		const wager = interaction.fields.getTextInputValue('wager');
		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';
		const challengerId = interaction.member.id;

		if (wager < 1) return await interaction.reply({ content: `Please enter a valid wager. Minimum is 1 ${oreEmoji}`, ephemeral: true });
		if (!Number(wager)) return await interaction.reply({ content: `Please enter a valid wager. Minimum is 1 ${oreEmoji}`, ephemeral: true });

		try {
			const challenger = await Player.findOne({
				where: { discordID: interaction.member.id, guildID: interaction.guild.id },
			});
			const guild = await Guild.findOne({ where: { guildID: interaction.guild.id } });

			if (!challenger) {
				throw new Error('profile not found');
			}

			if (!isTestnet) {
				if (challenger.oresEarned < wager || !challenger.oresEarned) {
					return await interaction.reply({ content: `You do not have enough ${oreEmoji} to wager.`, ephemeral: true });
				}
				challenger.oresEarned -= wager;
				guild.walletAmount += wager;
			}

			const listingId = await generateId(5);
			const embed = new EmbedBuilder()
				.setTitle('⚔️ Brawl Challenge Open ⚔️')
				.setColor(0xcd7f32)
				.setDescription(`**Challenger:** ${userMention(challengerId)}\nWager: ${wager} ${oreEmoji}\nStatus: Pending`)
				.setTimestamp()
				.setThumbnail(`${interaction.member.displayAvatarURL({ extension: 'png', size: 512 })}`)
				.setFooter({ text: `Listing ID: ${listingId}` });

			const button = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('brawl-accept')
					.setEmoji('✋')
					.setLabel('Accept')
					.setStyle(ButtonStyle.Primary),
			);

			const message = await interaction.reply({
				content: 'A new challenge has been created!',
				embeds: [embed],
				components: [button],
			});

			await Brawl.create({
				listingId,
				challengerId,
				wager,
				status: 'pending',
			});

			setTimeout(async () => {
				try {
					const brawl = await Brawl.findOne({ where: { listingId } });
					if (brawl && !brawl.outcome) {
						brawl.status = 'expired';
						await brawl.save();

						const expiredChallenger = await Player.findOne({ where: { discordID: challengerId, guildID: interaction.guild.id } });
						if (expiredChallenger) {
							expiredChallenger.oresEarned += wager;
							await expiredChallenger.save();
						}

						if (!isTestnet) {
							guild.walletAmount -= wager;
							await guild.save();
						}
					}

					// Try to delete the message
					try {
						if (message) await message.delete();
					}
					catch (err) {
						if (err.code !== 10008) {
							console.error('An unexpected error occurred while deleting the message:', err);
						}
					}
				}
				catch (error) {
					console.error('An error occurred:', error);
				}
			}, 10 * 60 * 1000);
		}
		catch (error) {
			console.error(error);
		}
	},
};
