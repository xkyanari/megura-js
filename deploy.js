const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('node:path');
const config = require('./config.json');

const token = process.env.DISCORD_TOKEN || config.token;
const clientId = process.env.DISCORD_CLIENT_ID || config.clientId;
const guildId = process.env.DISCORD_GUILD_ID || config.guildId;

// `node deploy.js --guild` registers commands to guildId only (instant, for testing)
const guildOnly = process.argv.includes('--guild');

// The commands to register: every slash command that is switched on.
const collectCommands = () => fs
	.readdirSync(path.join(__dirname, 'commands', 'slash-commands'))
	.filter((file) => file.endsWith('.js'))
	.flatMap((file) => {
		const command = require(`./commands/slash-commands/${file}`);
		if (!('data' in command)) {
			console.log(`[WARNING] The slash command at ${file} is missing a required "data" property.`);
			return [];
		}
		// switched-off features (e.g. auctions) aren't registered, so they disappear from Discord
		if (command.isEnabled && !command.isEnabled()) return [];
		// server-only unless the command says it works in DMs
		return [{ ...command.data.toJSON(), dm_permission: Boolean(command.dm) }];
	});

const deploy = async () => {
	const commands = collectCommands();
	const rest = new REST({ version: '9' }).setToken(token);

	try {
		console.log(
			`Started refreshing ${commands.length} application (/) commands.`,
		);

		await rest.put(
			guildOnly
				? Routes.applicationGuildCommands(clientId, guildId)
				: Routes.applicationCommands(clientId),
			{ body: commands },
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
			`Successfully reloaded ${commands.length} application (/) commands.`,
		);
	}
	catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
};

if (require.main === module) deploy();

module.exports = { collectCommands };
