const ms = require('ms');
const redis = require('../../redis');
const { executeAttack } = require('../../functions/attack');

const COOLDOWN = 25000;

module.exports = {
	data: {
		name: 'attack',
	},
	async execute(interaction) {
		// share /attack's cooldown, so alternating the command and this button can't double the rate
		const key = `${interaction.user.id}:${interaction.guildId ?? 'dm'}:attack`;
		const claimed = await redis.set(key, Date.now() + COOLDOWN, 'PX', COOLDOWN, 'NX');
		if (!claimed) {
			const remaining = Math.max(Number(await redis.get(key)) - Date.now(), 0);
			return interaction.reply({ content: `You are on cooldown for another ${ms(remaining)}.`, flags: 64 });
		}

		try {
			await executeAttack(interaction);
		}
		catch (error) {
			await redis.del(key);
			throw error;
		}
	},
};
