const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");
const { clientId, guildId, token } = require("./config.json");

const commands = [];
const slashCommandFiles = fs
  .readdirSync("./commands/slash-commands")
  .filter((file) => file.endsWith(".js"));

// For slash commands
for (const file of slashCommandFiles) {
  const command = require(`./commands/slash-commands/${file}`);
  if ("data" in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(
      `[WARNING] The slash command at ${file} is missing a required "data" property.`
    );
  }
}

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    await rest.put(
      // For guild commands
      // Routes.applicationGuildCommands(clientId, guildId),

      // For global commands
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    // For deleting registered slash commands -----------------
    // comment/uncomment whenever

    // removing a single slash command template
    // replace commandId with the ID you get from Settings > Apps > Integrations
    // // for guild-based commands
    // rest.delete(Routes.applicationGuildCommand(clientId, guildId, 'commandId'))
    // 	.then(() => console.log('Successfully deleted guild command'))
    // 	.catch(console.error);

    // // for global commands
    // rest.delete(Routes.applicationCommand(clientId, 'commandId'))
    // 	.then(() => console.log('Successfully deleted application command'))
    // 	.catch(console.error);

    // // for deleting all slash commands
    // // for guild-based commands
    // await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] })
    // .then(() => console.log('Successfully deleted all guild commands.'))
    // .catch(console.error);

    // // for global commands
    // await rest.put(Routes.applicationCommands(clientId), { body: [] })
    // .then(() => console.log('Successfully deleted all application commands.'))
    // .catch(console.error);

    console.log(
      `Successfully reloaded ${commands.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();
