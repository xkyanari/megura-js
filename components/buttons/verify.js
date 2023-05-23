const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  data: {
    name: `verify`,
  },
  async execute(interaction) {
    const verified = interaction.guild.roles.cache.get("1073827215957032966");

    if (
      interaction.member.roles.cache.some((role) => role.name === verified.name)
    ) {
      return interaction.reply({ content: `You're all set!`, ephemeral: true });
    } else {
      await interaction.member.roles.add(verified);
      await interaction.reply({ content: `Verified!`, ephemeral: true });
    }
  },
};
