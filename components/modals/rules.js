const { EmbedBuilder } = require("discord.js");
const { Guild } = require("../../src/db");

module.exports = {
  data: {
    name: `rules`,
  },
  async execute(interaction) {
    const intro = interaction.fields.getTextInputValue("intro");
    const rules = interaction.fields.getTextInputValue("rules");
    const closing = interaction.fields.getTextInputValue("closing");

    try {
      const getRules = async (intro, rules = null, closing = null) => {
        const guild = await Guild.findOne({
          where: { guildID: interaction.guild.id },
        });

        let description = intro;
        guild.intro = intro;

        if (rules) {
          description += `\n\n${rules}`;
          guild.rules = rules;
        }
        if (closing) {
          description += `\n\n${closing}`;
          guild.closing = closing;
        }

        await guild.save();
        return description;
      };

      const embed = new EmbedBuilder()
        .setTitle(`👋 Welcome to __${interaction.guild.name}__!`)
        .setColor(0xcd7f32)
        .setDescription(await getRules(intro, rules, closing));

      await interaction.reply({
        content: `Rules have been saved in the server.`,
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
    }
  },
};
