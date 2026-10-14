const { sequelize, Shop, Monster, Quest } = require('./src/db');

// Add missing seed rows without dropping tables or replacing existing data.
(async () => {
	await sequelize.sync();
	for (const [model, file, key] of [[Shop, 'item_db.json', 'item_ID'], [Monster, 'mob_db.json', 'monsterName'], [Quest, 'quest_db.json', 'questName']]) {
		const rows = require(`./assets/${file}`);
		for (const row of rows) await model.findOrCreate({ where: { [key]: row[key] }, defaults: row });
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
}).finally(() => sequelize.close());
