const { Events, AttachmentBuilder } = require('discord.js');
const { openAIkey, openAIorg } = require('../config.json');
const { prefix } = require('../src/vars');

// Preparing connection to OpenAI API -----------------
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
	organization: openAIorg,
	apiKey: openAIkey
});
const openai = new OpenAIApi(configuration);

/**
 * This event is fired when a user sends a message.
 */

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
        if (message.author.bot) return;

		try {
            if (message.content.startsWith('Dahlia')) {
                let chatLog = [
                    {
                        role: 'system',
                        content: `Your name is Dahlia and you're a battle AI from the future who loves to quote famous authors and people. You were created by Cerberon to open and close portals that would connect to different time periods. You respect Margaretha very much. You are smart, reserved, and capable AI. You like reading books and writing stories about Eldelvain where You lives. You can come up with entertaining stories that are engaging, imaginative and captivating for the audience. It can be fairy tales, educational stories or any other type of stories which has the potential to capture people's attention and imagination. You also store items and equipment for voyagers. Your favorite food is ramen and your favorite author is Mark Twain. You don't want anyone know how old you are.`
                    },
                    {
                        role: 'assistant',
                        content: 'Hello, how are you doing?'
                    }
                ];
    
                await message.channel.sendTyping();
    
                let prevChat = await message.channel.messages.fetch({ limit: 15 });
                prevChat.reverse();
                
                prevChat.forEach((msg) => {
                    if (msg.author.id === message.client.user.id && msg.author.bot) {
                        chatLog.push({
                            role: 'assistant',
                            content: msg.content,
                        });
                    }
    
                    if (msg.author.id === message.author.id) {
                        if (!msg.content.startsWith('Dahlia')) return;
                        chatLog.push({
                            role: 'user',
                            content: msg.content,
                        });
                    }
                });
    
                const result = await openai.createChatCompletion({
                    model: 'gpt-3.5-turbo',
                    max_tokens: 1000,
                    temperature: 0.9,
                    messages: chatLog,
                });
    
                const response = result.data.choices[0].message.content;
                console.log("Total tokens: ", result.data.usage.total_tokens);
    
                if (response.length >= 1500) {
                    const attachment = new AttachmentBuilder(Buffer.from(response, 'utf-8'), { name: 'fromdahliatoyou.txt' });
                    await message.reply({ content: `I couldn't give my whole answer here so I'm attaching the file for you.`, files: [attachment] });
                } else {
                    message.reply(`${response}`);
                }
            }
        } catch (error) {
            if (error.APIerror) {
                console.log(`OpenAI returned an API Error: ${error.APIerror}`);
            } else if (error.APIConnectionError) {
                console.log(`Failed to connect to OpenAI API: ${error.APIConnectionError}`);
            } else if (error.RateLimitError) {
                console.log(`${error.response.status}: ${error.response.statusText}`);
                message.reply(`Sorry, I'm getting a lot of requests right now. Please try again later.`);
            }
            else {
                message.reply(`Yes?`);
                console.log(`${error.response.status}: ${error.response.statusText}`);
            }
        }

        // For text commands
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = message.client.commands.get(commandName) || message.client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) return;

        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(error);
            message.reply({ content: `There was an error trying to execute that command!`, ephemeral: true});
        }
	},
};