const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('vote')
		.setDescription('Support Dahlia!'),
	cooldown: 3000,
	// works in DMs too (everything else is server-only)
	dm: true,
	async execute(interaction) {

		const embed = new EmbedBuilder()
			.setTitle('Vote for Us!')
			.setImage(
				'https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png',
			)
			.setDescription(
				`**Messinia Graciene: Project DAHLIA**
                Vote for our bot, Dahlia, and earn **50 IURA** each time!
                That's a potential of 200 IURA per day (2x per link).

                🔹[Top.gg](https://top.gg/bot/1108464420465692795/vote)
                🔹[Discordbotlist.com](https://discordbotlist.com/bots/dahlia/upvote)
                
                Also check these out:
                🔸[Add Me to your Server](https://discord.com/api/oauth2/authorize?client_id=1108464420465692795&permissions=139855260823&scope=bot)
                🔸[Documentation](https://docs.megura.xyz)
                
                Thank you for your support and happy voting!! (◕‿◕)`,
			);

		await interaction.reply({ embeds: [embed] });
	},
};
