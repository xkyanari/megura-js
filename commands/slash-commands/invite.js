const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('invite')
		.setDescription('Add Dahlia to your server!'),
	cooldown: 3000,
	async execute(interaction) {

		const embed = new EmbedBuilder()
			.setTitle('Add to Server')
			.setImage(
				'https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png',
			)
			.setDescription(
				`**Messinia Graciene: Project DAHLIA**
                Dahlia is a Discord RPG and server utility bot with storytelling, moderation, and multiplayer game features.

                [>> CLICK ME TO ADD <<](https://discord.com/api/oauth2/authorize?client_id=1108464420465692795&permissions=139855260823&scope=bot)
                
                Also check these out:
                🔸[Documentation](https://docs.megura.xyz)
                🔸[Support Server](https://discord.gg/X9eEW6yuhq)
                🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)
                
                Thank you! (◕‿◕)`,
			);

		await interaction.reply({ embeds: [embed] });
	},
};
