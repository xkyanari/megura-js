const { SlashCommandBuilder } = require("discord.js");
const profile = require("../../functions/profile");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show a player's profile")
    .addUserOption((option) =>
      option
        .setName("player")
        .setDescription("Choose the player you want to check.")
        .setRequired(false)
    ),
  cooldown: 3000,
  async execute(interaction) {
    const getPlayer = interaction.options.getUser("player");
    const member = getPlayer === null ? interaction.user : getPlayer;

    await profile(interaction, member);
  },
};
