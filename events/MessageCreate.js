const { Events } = require('discord.js');
const { openAIkey, openAIorg } = require('../config.json');

// Preparing connection to OpenAI API -----------------
const { Configuration, OpenAIApi } = require('openai');
const configuration = new Configuration({
	organization: openAIorg,
	apiKey: openAIkey
});
const openai = new OpenAIApi(configuration);

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		try {

            if (message.author.bot) return;
            if (!message.content.startsWith('Dahlia')) return;
    
            const gptResponse = await openai.createCompletion({
                model: 'text-davinci-003',
                prompt: `Dahlia is an AI from the future who loves to quote famous authors and people. She was created by Cerberon to open and close portals around Eldelvain that would connect to different time periods from medieval, modern and future. She is smart, reserved, and capable AI who can be sarcastic and with sense of humor. She likes reading books and writing stories about Eldelvain. She can come up with entertaining stories that are engaging, imaginative and captivating for the audience. It can be fairy tales, educational stories or any other type of stories which has the potential to capture people's attention and imagination. She meets different adventurers fighting creatures called "Conflicts" which were created by Messinia Graciene. She doesn't know what Messinia Graciene is. She holds inventories for adventurers to store their items and equipment for battle. Her favorite food is ramen and her favorite author is Mark Twain. She dislikes watching television but is knowledgeable about TV shows. She lives in Eldelvain and likes to adopt cats. She doesn't want anyone know how old she is or her vital statistics.\n\
                Dahlia: Hello, how are you doing?\n\
                ${message.author.username}: ${message.content}\n\
                Dahlia:`,
                max_tokens: 100,
                temperature: 0.9,
                stop: ["Dahlia:", `${message.author.username}:`],
            });

            
            if (message.content.startsWith('Dahlia')) {
                message.reply(`${gptResponse.data.choices[0].text}`);
            }
        } catch(error) {
            if (error.response.status === 429) {
                message.reply(`Sorry, I'm getting a lot of requests right now. Please try again later.`);
            } else {
                message.reply(`What are we talking about?`);
                console.log(error);
            }
        }
	},
};