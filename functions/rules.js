const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = async (interaction) => {
  try {
    const rule = new ModalBuilder().setCustomId("rules").setTitle("Rules");

    const intro = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("intro")
        .setLabel("Enter your introduction about the server.")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(300)
        .setRequired(true)
    );

    const rules = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rules")
        .setLabel("Enumerate the rules.")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
    );

    const closing = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("closing")
        .setLabel("Enter closing.")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(500)
        .setRequired(true)
    );

    rule.addComponents(intro, rules, closing);

    await interaction.showModal(rule);
  } catch (error) {
    console.error(error);
  }
};
