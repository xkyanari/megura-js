const { Monster, Shop, Contract, Quest, Player, Guild } = require('./src/db');

(async () => {
    await Quest.sync({ force: true})
        .then(() => {
            const quests = require('./assets/quest_db.json');
            for (let quest = 0; quest < quests.length; quest++) {
                Quest.create(quests[quest]);
            }
            console.log("Quest data import completed.");
        })
        .catch((error) => console.log(error));
    
    await Contract.sync({ force: true })
        .then(() => {
            const contracts = require('./assets/contracts.json');
            for (let contract = 0; contract < contracts.length; contract++) {
                Contract.create(contracts[contract]);
            }
            console.log("Contract data import completed.");
        })
        .catch((error) => console.log(error));
    
    await Guild.sync({ alter: true });
})();