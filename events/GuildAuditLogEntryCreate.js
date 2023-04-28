const { Events, AuditLogEvent } = require('discord.js');
// const sendLogs = require('../functions/logs');

/**
 * This event is fired when something is happening.
 */

module.exports = {
	name: Events.GuildAuditLogEntryCreate,
	async execute(auditLog, guild) {
		// // Define your variables.
        // const { action, executorId, target, targetId } = auditLog;

        // // Check only for deleted messages.
        // if (action !== AuditLogEvent.MessageDelete) return;

        // // Ensure the executor is cached.
        // const user = await guild.client.users.fetch(executorId);
        // console.log(user);

        // if (target) {
        //     // The message object is in the cache and you can provide a detailed log here.
        //     console.log(`A message by ${target.tag} was deleted by ${user.tag}.`);
        // } else {
        //     // The message object was not cached, but you can still retrieve some information.
        //     console.log(`A message with id ${targetId} was deleted by ${user.tag}.`);
        // }
	},
};