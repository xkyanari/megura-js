const findTxtFile = require('../functions/readfile');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports = async (interaction, chapterFile) => {
    try {
        const fileContent = await findTxtFile(chapterFile);
    
        if (!fileContent) {
            console.log(`No content found for '${chapterFile}'.`);
            return;
        }
    
        const lines = fileContent.split('\n\n');
    
        let delayTime = 0;
    
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const match = line.match(/^(\d+) seconds$/i);
    
            if (match) {
                delayTime = parseInt(match[1]) * 1000;
                continue;
            }
    
            await interaction.channel.send(line);
            await sleep(delayTime);
        }           
    } catch (error) {
        console.error(error);
    }
};