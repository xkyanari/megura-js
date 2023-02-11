const { Events } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
    
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
    
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: `Error executing ${interaction.commandName}`, ephemeral: true });
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
        }


	},
};