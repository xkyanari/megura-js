const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("support")
    .setDescription("Join our Support Server!"),
  cooldown: 3000,
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle("Join our Support Server!")
      .setImage(
        "https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png"
      )
      .setDescription(
        `**Messinia Graciene: Project DAHLIA**
                🔹Play with our exclusive version of Dahlia!
                🔹Meet our awesome community
                🔹Be the first to receive the latest updates
                🔹Get support from the developers

                Server link: https://discord.gg/X9eEW6yuhq

                Also check these out:
                🔸[Add Me to your Server](https://discord.com/api/oauth2/authorize?client_id=1108464420465692795&permissions=139855260823&scope=bot)
                🔸[Documentation](https://docs.megura.xyz)
                🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)
                
                Thank you! (◕‿◕)`
      );

    await interaction.reply({ embeds: [embed] });
  },
};
