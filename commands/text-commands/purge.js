const { PermissionsBitField } = require("discord.js");

module.exports = {
  name: "purge",
  description: "Purge messages in a channel.",
  usage: "<number of hours>",
  async execute(message, args) {
    if (
      !message.channel
        .permissionsFor(message.client.user)
        .has(PermissionsBitField.Flags.ManageMessages)
    )
      return await message.channel.send({
        content: `I don't seem have permissions to purge messages here.`,
        ephemeral: true,
      });

    const hours = Number(args.join(" "));
    if (!hours)
      return message.reply({
        content: "Please provide the number of hours to delete messages from.",
      });

    try {
      // Calculate the timestamp of the cutoff
      const cutoffTimestamp = Date.now() - hours * 60 * 60 * 1000;

      // Fetch messages
      const fetchedMessages = await message.channel.messages.fetch({
        limit: 100,
      });

      // Filter messages by timestamp
      const messagesToDelete = fetchedMessages.filter(
        (msg) => msg.createdTimestamp >= cutoffTimestamp
      );

      // Bulk delete messages
      const messageIDs = messagesToDelete.map((msg) => msg.id);
      await message.channel.bulkDelete(messageIDs);

      // Calculate the remaining messages that couldn't be deleted
      const remainingMessages = fetchedMessages.size - messagesToDelete.size;

      await message.channel.send(
        `Successfully purged \`${messagesToDelete.size}\` messages from the past \`${hours}\` hours.\n\`${remainingMessages}\` messages were not deleted due to Discord API restrictions.\n\nYou may delete this message now.`
      );
    } catch (error) {
      console.error(error);

      if (error.code === 50034) {
        await message.channel.send(
          "You can only bulk delete messages that are under 14 days old."
        );
      } else {
        await message.channel.send(
          `There was an error trying to purge messages.`
        );
      }
    }
  },
};
