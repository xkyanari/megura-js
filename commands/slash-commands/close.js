const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Closes a portal"),
  cooldown: 13000,
  async execute(interaction) {
    const { channel, member } = interaction;

    try {
      if (member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        const time = 10;
        const embed = new EmbedBuilder()
          .setColor(0x6e8b3d)
          .setTitle("Consider it done.")
          .setDescription(
            `This channel will be deleted in \`${time}\` seconds.`
          );

        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply("You do not have sufficient privileges.");
      }
      setTimeout(() => {
        channel.delete().catch(console.error);
      }, 10000);
    } catch (error) {
      console.error(error);
    }
  },
};
