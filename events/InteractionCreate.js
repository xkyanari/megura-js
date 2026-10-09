const { Events, EmbedBuilder, DiscordAPIError } = require('discord.js');
const ms = require('ms');
const { checkProfile } = require('../src/vars');
const logger = require('../src/logger');
const redis = require('../redis');

/**
 * This event is fired when a user initiates slash commands.
 */

const MAX_CONSECUTIVE_COMMANDS = 10;
const TOLERANCE = 1000;

// Replies, edits the deferred reply, or follows up, depending on what the interaction has already done.
const safeReply = async (interaction, payload) => {
	try {
		if (interaction.deferred && !interaction.replied) {
			return await interaction.editReply(payload);
		}
		if (interaction.replied) {
			return await interaction.followUp({ ...payload, flags: 64 });
		}
		return await interaction.reply({ ...payload, flags: 64 });
	}
	catch (error) {
		console.error('Failed to send error reply:', error);
	}
};

const errorReply = (interaction, name, error) => {
	if (error.message === 'profile not found') {
		return safeReply(interaction, { content: checkProfile, embeds: [] });
	}

	if (error.message === 'guild not found') {
		return safeReply(interaction, { content: 'Please register the guild first.', embeds: [] });
	}

	if (error instanceof DiscordAPIError && error.code === 50013) {
		const embed = new EmbedBuilder()
			.setColor('Red')
			.setDescription(`
				I do not have the required permissions to execute this command.
				Please check the permissions and try again.
			`);
		return safeReply(interaction, { content: '', embeds: [embed] });
	}

	console.error(error);
	const embed = new EmbedBuilder().setColor('Red').setDescription(`
		Error executing \`${name}\`
		Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
	return safeReply(interaction, { content: '', embeds: [embed] });
};

// Flags users whose last MAX_CONSECUTIVE_COMMANDS commands came at near-constant intervals.
const isAutomated = async (counterKey) => {
	const counter = (await redis.lrange(counterKey, 0, -1)).map(Number);
	if (counter.length < MAX_CONSECUTIVE_COMMANDS) return false;

	const intervals = counter.slice(1).map((time, i) => time - counter[i]);
	const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

	return intervals.every((interval) => Math.abs(interval - average) <= TOLERANCE);
};

const logUsage = (interaction, kind, name) => {
	logger.log({
		level: 'info',
		message: `User: ${interaction.user.id}, ${kind}: ${name}, Time: ${new Date().toISOString()}`,
	});
};

const UNAVAILABLE = 'This feature is currently unavailable.';

const handleCommand = async (interaction) => {
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching \`${interaction.commandName}\` was found.`);
		return;
	}

	if (command.isEnabled && !command.isEnabled()) {
		return interaction.reply({ content: UNAVAILABLE, flags: 64 });
	}

	// commands registered before DMs were turned off can still arrive from a DM
	if (!interaction.guildId && !command.dm) {
		return interaction.reply({ content: 'Please use this command in a server.', flags: 64 });
	}

	const interactionScope = interaction.guildId ?? 'dm';
	const counterKey = `counter:${interaction.user.id}:${interactionScope}`;

	if (await isAutomated(counterKey)) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.user.id}, Command: ${command.data.name}, with consistent intervals.`,
		});

		return interaction.reply({
			content: 'You\'re doing that too frequently. Please wait a moment before trying again.',
			flags: 64,
		});
	}

	await redis.rpush(counterKey, Date.now());
	await redis.ltrim(counterKey, -MAX_CONSECUTIVE_COMMANDS, -1);
	await redis.expire(counterKey, 30);

	const cooldownKey = `${interaction.user.id}:${interactionScope}:${interaction.commandName}`;
	const existingCooldown = await redis.get(cooldownKey);
	if (existingCooldown) {
		const remainingTime = existingCooldown - Date.now();
		return interaction.reply({
			content: `You are on cooldown for another ${ms(Math.max(remainingTime, 0))}`,
			flags: 64,
		});
	}

	logUsage(interaction, 'Command', command.data.name);

	// set before running so the same command can't run twice at once
	await redis.set(cooldownKey, Date.now() + command.cooldown, 'PX', command.cooldown);

	try {
		await command.execute(interaction);
	}
	catch (error) {
		// don't make users wait out a cooldown for a command that failed
		await redis.del(cooldownKey);
		await errorReply(interaction, interaction.commandName, error);
	}
};

const handleComponent = async (interaction, collection, kind) => {
	const { client, customId } = interaction;
	const component = collection.get(customId) || collection.get(customId.split(':')[0]);
	if (!component) {
		console.error(`There is no code for the ${kind} \`${customId}\`.`);
		return;
	}

	// e.g. an auction button still showing in a channel after auctions were switched off
	if (component.isEnabled && !component.isEnabled()) {
		return interaction.reply({ content: UNAVAILABLE, flags: 64 });
	}

	const interactionScope = interaction.guildId ?? 'dm';
	const cooldownKey = `${customId}:${interaction.user.id}:${interactionScope}`;
	const cooldown = component.data.cooldown;

	if (cooldown && client.cooldown.has(cooldownKey)) {
		const timer = ms(Math.max(client.cooldown.get(cooldownKey) - Date.now(), 0));
		return interaction.reply({
			content: `You are on cooldown for another ${timer}.`,
			flags: 64,
		});
	}

	logUsage(interaction, kind, customId);

	if (cooldown) {
		client.cooldown.set(cooldownKey, Date.now() + cooldown);
		setTimeout(() => client.cooldown.delete(cooldownKey), cooldown);
	}

	try {
		await component.execute(interaction);
	}
	catch (error) {
		client.cooldown.delete(cooldownKey);
		await errorReply(interaction, customId, error);
	}
};

const handleAutocomplete = async (interaction) => {
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command?.autocomplete) {
		console.error(`No autocomplete for \`${interaction.commandName}\` was found.`);
		return;
	}

	try {
		await command.autocomplete(interaction);
	}
	catch (error) {
		// autocomplete interactions can't show an error message
		console.error(error);
	}
};

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		const { buttons, menus, modals } = interaction.client;

		try {
			if (interaction.isChatInputCommand() || interaction.isUserContextMenuCommand()) {
				return await handleCommand(interaction);
			}
			if (interaction.isButton()) {
				return await handleComponent(interaction, buttons, 'Button');
			}
			if (interaction.isStringSelectMenu()) {
				return await handleComponent(interaction, menus, 'Menu');
			}
			if (interaction.isModalSubmit()) {
				return await handleComponent(interaction, modals, 'Modal');
			}
			if (interaction.isAutocomplete()) {
				return await handleAutocomplete(interaction);
			}
		}
		catch (error) {
			// e.g. Redis is down; never let this become an unhandled rejection
			console.error(error);
		}
	},
};
