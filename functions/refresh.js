const { Monster, Shop, Contract, Quest, Player } = require('../src/db');

module.exports = async () => {

    // creating a test account
    const kyanari = await Player.create({ guildID: '1073827215957032960', discordID: '119671611803697152', playerName: 'Kyanari', faction: 'Margaretha' });
    await kyanari.createIura({ walletName: 'Kyanari', bankName: 'Kyanari' });
    console.log(`Player creation successful.`);
    
    // loading quests
    const quests = require('../assets/quest_db.json');
    for (let quest = 0; quest < quests.length; quest++) {
        Quest.create(quests[quest]);
    }
    console.log("Quest data import completed.");

    // loading monsters
    const monsters = require('../assets/mob_db.json');
    for (let monster = 0; monster < monsters.length; monster++) {
        Monster.create(monsters[monster]);
    }
    console.log("Monster data import completed.");

    // loading items
    const items = require('../assets/item_db.json');
    for (let item = 0; item < items.length; item++) {
        Shop.create(items[item]);
    }
    console.log("Item data import completed.");

    // loading contracts
    const contracts = require('../assets/contracts.json');
    for (let contract = 0; contract < contracts.length; contract++) {
        Contract.create(contracts[contract]);
    }
    console.log("Contract data import completed.");
};