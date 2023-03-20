const { Events } = require('discord.js');
const ms = require('ms');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
            const client = interaction.client;
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching \`${interaction.commandName}\` was found.`);
                return;
            }

            const cooldownData = `${interaction.commandName}${interaction.user.id}`;

            if (client.cooldown.has(cooldownData)) {
                const timer = ms(client.cooldown.get(cooldownData) - Date.now());
                return interaction.reply({content: `You are on cooldown for another ${timer}.`, ephemeral: true});
            }

                try {
                    client.cooldown.set(cooldownData, Date.now() + command.cooldown);
                    await command.execute(interaction);
                    setTimeout(() => client.cooldown.delete(cooldownData), command.cooldown);

                } catch (error) {
                    console.log(error);
                    await interaction.reply({ content: `Error executing \`${interaction.commandName}\``, ephemeral: true });
                }                    
        } else if (interaction.isButton()) {
            const { buttons } = interaction.client;
            const { customId } = interaction;
            const button = buttons.get(customId);
            if (!button) return new Error('There is no code for this button');

            try {
                await button.execute(interaction);
            } catch (error) {
                console.error(error);
            }
        } else if (interaction.isStringSelectMenu()) {
            const { menus } = interaction.client;
            const { customId } = interaction;
            const menu = menus.get(customId);
            if (!menu) return new Error('There is no code for this menu');

            try {
                await menu.execute(interaction);
            } catch (error) {
                console.error(error);
            }
        }

	},
};