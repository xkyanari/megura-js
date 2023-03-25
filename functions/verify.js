const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async (interaction, channel) => {
	const message = interaction.client.channels.cache.get(channel.id);
	
	const embed = new EmbedBuilder()
		.setTitle(`YOU HAVE ENTERED __ELDELVAIN__, MESSINIA GRACIENE'S DOMAIN.`)
		.setDescription(`
			__**RULES -- PLEASE READ!**__

			__Be respectful, civil, and welcoming.__
			We do not tolerate rude and toxic people here.
			
			__Do not join the server to promote your content.__
			We accept collaborations and take them to consideration seriously.
			
			__The primary language of this server is English.__
			We will try to add more language channels in the future.
			
			__Do not ping staff members for no reason.__
			
			And lastly, please follow the Discord Terms of Service.
			
			If you agree to these terms, please click "Verify" to get access to the server.
		`);
	
	const button = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('verify')
				.setEmoji('✅')
				.setLabel('Verify')
				.setStyle(ButtonStyle.Success)
		);
	
	await message.send({ embeds: [embed], components: [button] });
};