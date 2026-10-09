const { EmbedBuilder } = require('discord.js');
const { Guild } = require('../../src/db');

module.exports = {
	data: {
		name: 'rules',
	},
	async execute(interaction) {
		const intro = interaction.fields.getTextInputValue('intro');
		const rules = interaction.fields.getTextInputValue('rules');
		const closing = interaction.fields.getTextInputValue('closing');

		const getRules = async () => {
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
			.setDescription(await getRules());

		await interaction.reply({
			content: 'Rules have been saved in the server.',
			embeds: [embed],
			flags: 64,
		});
	},
};
