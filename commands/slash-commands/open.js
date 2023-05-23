const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { Player } = require("../../src/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("open")
    .setDescription("Creates a portal")
    .addStringOption((option) =>
      option
        .setName("channel")
        .setDescription("Enter name of channel")
        .setRequired(true)
    ),
  cooldown: 900000,
  async execute(interaction) {
    const channel_name = interaction.options.getString("channel");
    const { member, guild } = interaction;

    await interaction.deferReply();

    const player = await Player.findOne({
      where: { discordID: member.id, guildID: guild.id },
    });

    if (!player)
      return interaction.editReply(
        "This user does not have a player profile in this world yet."
      );

    try {
      if (
        !member.roles.cache.some(
          (role) => role.name === "Margaretha" || role.name === "Cerberon"
        )
      )
        return interaction.editReply(
          "You don't seem to have a proper faction yet. Please choose your faction then `/start` again."
        );

      const guild_name = await guild.channels.create({
        name: channel_name,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id, // Everyone else except for admins
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id, // The user
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ManageChannels,
            ],
          },
          {
            id: interaction.client.user.id, // The bot
            allow: [PermissionFlagsBits.ViewChannel],
          },
        ],
      });

      const time = 10;
      const wait = require("node:timers/promises").setTimeout;
      const embed = new EmbedBuilder()
        .setColor(0xcd7f32)
        .setTitle("Success!")
        .setDescription(
          `Portal: **${guild_name}** has been opened.\n\nPlease note that the portal gets closed after \`${time}\` minute/s! Just create another one whenever.\n\nIf you want to close the channel pre-maturely, you can run the \`/close\` command.\n\nSafe travels!`
        );
      interaction.editReply({
        content: `${member}`,
        embeds: [embed],
        ephemeral: true,
      });
      await wait(600000);
      await guild_name
        .delete()
        .then(() => {
          const embed2 = new EmbedBuilder()
            .setColor(0x6e8b3d)
            .setTitle("Times Up!")
            .setDescription(
              "Your portal has been closed. Thanks for using our services!"
            );
          interaction.followUp({
            content: `${member}`,
            embeds: [embed2],
            ephemeral: true,
          });
        })
        .catch(() => {
          const embed2 = new EmbedBuilder()
            .setColor(0x6e8b3d)
            .setTitle("Uh-oh!")
            .setDescription(
              "Looks like your portal vanished into thin air. Oh well..."
            );
          interaction.followUp({
            content: `${member}`,
            embeds: [embed2],
            ephemeral: true,
          });
        });
    } catch (error) {
      console.error(error);
    }
  },
};
