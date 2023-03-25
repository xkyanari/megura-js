const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('faction')
		.setDescription('Execute message to your #choose-your-faction channel.')
        .setDefaultMemberPermissions('0'),
    cooldown: 3000,
	async execute(interaction) {
		const embed = new EmbedBuilder()
            .setTitle('Choose your Faction')
            .setDescription(
                `Please choose which faction resonates with your principles the most:
				
				⚔️ **Cerberon** ⚔️
				Cerberon follows __logic__. He thinks that solving problems would help remove the pain and despair. He's willing to take risks to achieve what he wants. He deals with life based from the past.
				
				🌺 **Margaretha** 🌺
				Margaretha follows __emotion__. She has compassion towards everything. She thinks moving forward is the best way to get over with grief. She deals with life for the future.
				`);

		await interaction.reply({
			embeds: [embed],
			components: [
				{
					"type": 1,
					"components": [
						{
							"type": 2,
							"custom_id": "cerberon",
							"emoji": "⚔️",
							"label": "Cerberon",
							"style": 1
						},
						{
							"type": 2,
							"custom_id": "margaretha",
							"emoji": "🌺",
							"label": "Margaretha",
							"style": 1
						}
					]
				}
			]
		});
	}
};