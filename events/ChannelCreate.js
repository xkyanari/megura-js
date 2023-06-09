const { Events, EmbedBuilder } = require('discord.js');
const CHANNEL_ID = '1073827217949331525';

/**
 * This event is fired when a user opens a portal or private channel.
 */

module.exports = {
	name: Events.ChannelCreate,
	async execute(channel) {
		// try {
		// 	const inactivityPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds
		// 	let timer;
		// 	// Check if the author of the creation message has the desired role(s)
		// 	const allowedRoles = ['Role1', 'Role2'];
		// 	const authorRoleOverwrites = [];
		// 	allowedRoles.forEach((roleName) => {
		// 		const role = channel.guild.roles.cache.find((r) => r.name === roleName);
		// 		if (role) {
		// 			const overwrite = channel.permissionOverwrites.find((o) => o.id === role.id && o.type === 'role');
		// 			if (overwrite) {
		// 				authorRoleOverwrites.push(overwrite);
		// 			}
		// 		}
		// 	});
		// 	if (authorRoleOverwrites.length > 0) {
		// 		channel.on('messageCreate', () => {
		// 			clearTimeout(timer);
		// 			timer = setTimeout(() => {
		// 				channel.delete().then(() => {
		// 					const embed2 = new EmbedBuilder()
		// 						.setColor(0xCD7F32)
		// 						.setTitle('Times Up!')
		// 						.setDescription('Your portal has been closed. Thanks for using our services!');
		// 					const notificationChannel = channel.guild.channels.cache.get(CHANNEL_ID);
		// 					if (notificationChannel) {
		// 						notificationChannel.send(embed2);
		// 					}
		// 				});
		// 			}, inactivityPeriod);
		// 		});
		// 	}
		// } catch (error) {
		// 	console.error(error);
		// }
	},
};
