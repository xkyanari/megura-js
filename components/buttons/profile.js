const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");
const profile = require("../../functions/profile");
const { Player } = require("../../src/db");

module.exports = {
  data: {
    name: `profile`,
  },
  async execute(interaction) {
    const member = interaction.user;

    await profile(interaction, member);
  },
};
