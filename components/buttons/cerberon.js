const { EmbedBuilder } = require("discord.js");
const { Player, Guild } = require("../../src/db");

module.exports = {
  data: {
    name: `cerberon`,
  },
  async execute(interaction) {
    const member = interaction.member;
    const guild = await Guild.findOne({
      where: { guildID: interaction.guild.id },
    });
    const player = await Player.findOne({
      where: { discordID: member.id, guildID: interaction.guild.id },
    });

    if (!player)
      return interaction.reply(
        "You do not have a player profile in this world yet."
      );
    if (!guild || !guild.margarethaID || !guild.cerberonID) return;

    const margaretha = await interaction.guild.roles.cache.get(
      guild.margarethaID
    );
    const cerberon = await interaction.guild.roles.cache.get(guild.cerberonID);

    try {
      const embed = new EmbedBuilder();

      if (member.roles.cache.some((role) => role.name === cerberon.name)) {
        return interaction.reply({
          content: `You are on ${cerberon.name} faction!`,
        });
      }

      if (member.roles.cache.some((role) => role.name === margaretha.name)) {
        await member.roles.remove(margaretha);
        embed.setDescription(
          `Removed \`${margaretha.name}\`.\nAdded \`${cerberon.name}\`.`
        );

        await member.roles.add(cerberon);
        player.faction = cerberon.name;

        await interaction.reply({ embeds: [embed] });
        return player.save();
      } else {
        await member.roles.add(cerberon);
        player.faction = cerberon.name;
        embed.setDescription(`Added \`${cerberon.name}\`.`);

        await interaction.reply({ embeds: [embed] });
        return player.save();
      }
    } catch (error) {
      console.log(error);
    }
  },
};
