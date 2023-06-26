const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roles')
		.setDescription('Check roles'),
	cooldown: 3000,
	async execute(interaction) {
        const guildId = interaction.guild.id;
        const roleId = '1073827215957032966'; // to be changed by actual role in prod

        const guild = await interaction.client.guilds.fetch(guildId);
        await guild.members.fetch();

        const role = guild.roles.cache.get(roleId);

        if (!role) {
            return console.log('Role not found');
        }

        const membersWithRole = guild.members.cache.filter(member => member.roles.cache.has(role.id));

        const userIds = membersWithRole.map(member => member.user.id).join('\n');

        const attachment = new AttachmentBuilder(
            Buffer.from(userIds, 'utf-8'),
            { name: 'fromdahliatoyou.txt' },
        );
        await interaction.reply({
            content: 'Please see attached.',
            files: [attachment],
        });
	},
};
