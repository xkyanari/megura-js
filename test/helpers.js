const { sequelize } = require('../src/db');
const redis = require('../redis');

// Drops and recreates every table.
const resetDb = () => sequelize.sync({ force: true });

const closeAll = async () => {
	await sequelize.close();
	redis.disconnect();
};

// Records what a handler sends back, the way discord.js would see it.
const recorder = () => {
	const calls = [];
	return {
		calls,
		push: (kind, payload) => calls.push([kind, payload]),
		kinds: () => calls.map(([kind]) => kind),
		content: (index) => {
			const payload = calls[index][1];
			return typeof payload === 'string' ? payload : payload.content;
		},
	};
};

const noop = async () => undefined;

module.exports = { resetDb, closeAll, recorder, noop };
