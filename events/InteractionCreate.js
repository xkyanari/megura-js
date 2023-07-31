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

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		const { client } = interaction;
		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);

			if (!command) {
				console.error(
					`No command matching \`${interaction.commandName}\` was found.`,
				);
				return;
			}

			const counterKey = `counter:${interaction.user.id}:${interaction.guild.id}`;

			let counter = await redis.lrange(counterKey, 0, -1);
			counter = counter ? counter.map(Number) : [];

			let checker = false;
			let averageInterval = 0;

			for (let i = 1; i < counter.length; i++) {
				let interval = counter[i] - counter[i - 1];
				averageInterval += interval;
			}
			averageInterval /= (counter.length - 1);

			for (let i = 1; i < counter.length; i++) {
				let interval = counter[i] - counter[i - 1];
				if (Math.abs(interval - averageInterval) <= TOLERANCE) {
					checker = true;
				}
				else {
					checker = false;
					break;
				}
			}

			if (checker && counter.length >= MAX_CONSECUTIVE_COMMANDS) {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, Command: ${command.data.name}, with consistent intervals.`,
				});

				return interaction.reply({
					content: `You're doing that too frequently. Please wait a moment before trying again.`,
					ephemeral: true,
				});
			}

			await redis.rpush(counterKey, Date.now());
			await redis.ltrim(counterKey, -MAX_CONSECUTIVE_COMMANDS, -1);
			await redis.expire(counterKey, 30);

			const cooldownData = `${interaction.user.id}:${interaction.guild.id}:${interaction.commandName}`;
			const existingCooldown = await redis.get(cooldownData);
			if (existingCooldown) {
				const remainingTime = existingCooldown - Date.now();
				const timer = ms(remainingTime > 0 ? remainingTime : 0);
				return interaction.reply({
					content: `You are on cooldown for another ${timer}`,
					ephemeral: true,
				});
			}

			try {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, Command: ${command.data.name}, Time: ${new Date().toISOString()}`,
				});

				await redis.set(cooldownData, Date.now() + command.cooldown, 'PX', command.cooldown);
				await command.execute(interaction);
				client.cooldown.set(cooldownData, Date.now() + command.cooldown);
				setTimeout(
					() => client.cooldown.delete(cooldownData),
					command.cooldown,
				);
			}
			catch (error) {
				if (error.message === 'profile not found') {
					return interaction.reply({
						content: checkProfile,
						ephemeral: true,
					});
				}

				if (error.message === 'guild not found') {
					return interaction.reply({
						content: 'Please register the guild first.',
						ephemeral: true,
					});
				}

				if (error instanceof DiscordAPIError && error.code === 50013) {
					const embed = new EmbedBuilder()
						.setColor('Red')
						.setDescription(`
							I do not have the required permissions to execute this command.
							Please check the permissions and try again.
						`);
					
					await interaction.reply({ embeds: [embed], ephemeral: true });
					client.cooldown.delete(cooldownData);
				}

				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.commandName}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);

				console.log(error);
				await interaction.reply({ embeds: [embed], ephemeral: true });
				client.cooldown.delete(cooldownData);
			}
		}
		if (interaction.isButton()) {
			const { buttons } = interaction.client;
			const { customId } = interaction;
			const button = buttons.get(customId);
			if (!button) return new Error('There is no code for this button.');

			const cooldownData = `${customId}:${interaction.user.id}:${interaction.guild.id}`;

			if (client.cooldown.has(cooldownData)) {
				const timer = ms(client.cooldown.get(cooldownData) - Date.now());
				return interaction.reply({
					content: `You are on cooldown for another ${timer}.`,
					ephemeral: true,
				});
			}

			try {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, Button: ${customId}, Time: ${new Date().toISOString()}`,
				});

				if (button.data.cooldown) {
					client.cooldown.set(cooldownData, Date.now() + button.data.cooldown);
					setTimeout(() => client.cooldown.delete(cooldownData), button.data.cooldown);
				}
				await button.execute(interaction);
			}
			catch (error) {
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.customId}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);

				console.log(error);
				await interaction.reply({ embeds: [embed], ephemeral: true });
				client.cooldown.delete(cooldownData);
			}
		}
		if (interaction.isStringSelectMenu()) {
			const { menus } = interaction.client;
			const { customId } = interaction;
			const menu = menus.get(customId);
			if (!menu) return new Error('There is no code for this menu.');

			try {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, Menu: ${customId}, Time: ${new Date().toISOString()}`,
				});
				await menu.execute(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.customId}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
		if (interaction.isModalSubmit()) {
			const { modals } = interaction.client;
			const { customId } = interaction;
			const modal = modals.get(customId);
			if (!modal) return new Error('There is no code for this modal.');

			try {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, Modal: ${customId}, Time: ${new Date().toISOString()}`,
				});
				await modal.execute(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.customId}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
		if (interaction.isUserContextMenuCommand()) {
			const contextCommand = client.commands.get(interaction.commandName);

			if (!contextCommand) {
				console.error(
					`No command matching \`${interaction.commandName}\` was found.`,
				);
				return;
			}

			try {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, Command: ${interaction.commandName}, Time: ${new Date().toISOString()}`,
				});
				await contextCommand.execute(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.commandName}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
		if (interaction.isAutocomplete()) {
			const autoCommand = client.commands.get(interaction.commandName);

			if (!autoCommand) {
				console.error(
					`No command matching \`${interaction.commandName}\` was found.`,
				);
				return;
			}

			try {
				logger.log({
					level: 'info',
					message: `User: ${interaction.user.id}, AutoCommand: ${interaction.commandName}, Time: ${new Date().toISOString()}`,
				});
				await autoCommand.autocomplete(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.commandName}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
	},
};