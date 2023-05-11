const { Events, AttachmentBuilder } = require('discord.js');
const { openAIkey, openAIorg } = require('../config.json');
const { prefix } = require('../src/vars');
const { Player, Guild } = require('../src/db');

// Preparing connection to OpenAI API -----------------
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
	organization: openAIorg,
	apiKey: openAIkey
});
const openai = new OpenAIApi(configuration);

const chatUsers = new Set();
const userTimeouts = {};

const inactivityTimeout = 15 * 60 * 1000; // 15mins of inactivity

const resetUserTimeout = (userID) => {
    if (userTimeouts[userID]) {
        clearTimeout(userTimeouts[userID]);
    }

    userTimeouts[userID] = setTimeout(() => {
        chatUsers.delete(userID);
        delete userTimeouts[userID];
    }, inactivityTimeout);
};

/**
 * This event is fired when a user sends a message.
 */

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
        if (message.author.bot) return;

        const guildCheck = await Guild.findOne({ where: { guildID: message.guild.id } });
        if (!guildCheck || !guildCheck.verifyRoleID) return;

        const isOnVerifyChannel = message.channel.id === guildCheck.verifyChannelID;
    
        if (isOnVerifyChannel) {
            await message.delete();
        }

        const player = await Player.findOne({ where: { discordID: message.author.id, guildID: message.guild.id }});

        let playerName = '';

        if (player) {
            let fullName = player.playerName;
            let firstName = fullName.split(' ')[0];
            playerName = `You know the user very well, as they are a voyager who has traveled through time with you on various adventures. You have a close relationship with them, and you usually address them by their name. Their name is ${firstName}`;
        }
        
        if (message.content.startsWith('Dahlia stop') || message.content.startsWith('dahlia stop')) {
            if (chatUsers.has(message.author.id)) {
                chatUsers.delete(message.author.id);
            }
            return;
        }

        if (message.content.startsWith('Dahlia') || message.content.startsWith('dahlia')) {
            chatUsers.add(message.author.id);
            resetUserTimeout(message.author.id);
        }

        if (chatUsers.has(message.author.id)) {
            resetUserTimeout(message.author.id);

            try {
                let chatLog = [
                    {
                        role: 'system',
                        content: `Your name is Dahlia and you're a battle AI from the future who loves to quote famous authors and people. You were created by Cerberon to open and close portals that would connect to different time periods. You know Margaretha but you don't know where she is. You simulate battles for the voyager to enhance their abilities. ${playerName}
                        
                        You are smart, reserved, and capable AI. You like reading books and writing stories about Eldelvain where you live. You also store items and equipment for voyagers. Your favorite food is ramen and your favorite author is Mark Twain. You don't want anyone to know how old you are or your vital statistics.
                    
                        You are the core of the project named "Project DAHLIA". If someone asks you about "Megura" or "Messinia Graciene", "Megura" is a NFT project with a Discord bot (that's you) that access information from supported NFT collections and use them for gaming. If you do not know the answers related to Megura or its NFTs, you will direct users to the Megura Whitepaper (https://docs.megura.xyz) or ask the moderators and the System Admin team. Gen 0 NFTs and mint dates are to be announced. Gen 1 NFTs will be 5656 in its collection.`
                    },
                    {
                        role: 'assistant',
                        content: 'Hello, how are you doing?'
                    }
                ];
        
                await message.channel.sendTyping();
        
                let allMessages = await message.channel.messages.fetch({ limit: 50 });
                allMessages.reverse();

                let messagesAfterLastCall = [];
                let foundLastCall = false;

                for (let msg of allMessages.values()) {
                    if (msg.author.id === message.author.id && (msg.content.startsWith('Dahlia') || msg.content.startsWith('dahlia'))) {
                        foundLastCall = true;
                        messagesAfterLastCall = [msg];
                    } else if (foundLastCall) {
                        messagesAfterLastCall.push(msg);
                    }
                }

                messagesAfterLastCall.forEach((msg) => {
                    if (msg.author.id === message.client.user.id && msg.author.bot) {
                        chatLog.push({
                            role: 'assistant',
                            content: msg.content,
                        });
                    }

                    if (msg.author.id === message.author.id) {
                        chatLog.push({
                            role: 'user',
                            content: msg.content,
                        });
                    }
                });
        
                const result = await openai.createChatCompletion({
                    model: 'gpt-3.5-turbo',
                    max_tokens: 1000,
                    temperature: 0.4,
                    messages: chatLog,
                    frequency_penalty: 0.3,
                    presence_penalty: 0.7
                });
        
                const response = result.data.choices[0].message.content;
                console.log("Total tokens: ", result.data.usage.total_tokens);
                
                if (response.length >= 2000) {
                    const attachment = new AttachmentBuilder(Buffer.from(response, 'utf-8'), { name: 'fromdahliatoyou.txt' });
                    await message.reply({ content: `I couldn't give my whole answer here so I'm attaching the file for you.`, files: [attachment] });
                } else {
                    message.reply(`${response}`);
                }
            } catch (error) {
                if (error.APIerror) {
                    console.log(`OpenAI returned an API Error: ${error.APIerror}`);
                } else if (error.APIConnectionError) {
                    console.log(`Failed to connect to OpenAI API: ${error.APIConnectionError}`);
                } else if (error.RateLimitError) {
                    console.log(`${error.response.status}: ${error.response.statusText}`);
                    message.reply(`Sorry, I'm getting a lot of requests right now. Please try again later.`);
                } else if (error.response && error.response.status === 400 && error.response.data.error.message.includes("Token limit exceeded")) {
                    console.log(`${error.response.status}: ${error.response.statusText}`);
                    message.reply(`Sorry, our conversation has become too long, and I can't process it. Please try a shorter message or remove some context.`);
                } else {
                    message.reply(`Yes?`);
                    console.log(`${error.response.status}: ${error.response.statusText}`);
                }
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