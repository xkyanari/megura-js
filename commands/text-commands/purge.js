module.exports = {
    name: 'purge',
    description: 'Purge messages in a channel.',
    usage: '<number of messages>',
    async execute(message, args) {
        const messages = Number(args.join(' '));
        if (!messages) return message.reply({ content: 'Please provide number of messages to delete.' });

        try {
            await message.channel.bulkDelete(messages);
            await message.channel.send(`Successfully purged ${messages} messages. You may delete this message now.`);
        } catch (error) {
            console.error(error);

            if (error.code === 50034) {
                await message.channel.send('You can only bulk delete messages that are under 14 days old.');
            } else {
                await message.channel.send(`There was an error trying to purge messages.`);
            }
        }
    },
};