const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const ms = require('ms');
const redis = require('../../redis');
const { Player } = require('../../src/db');
const { footer } = require('../../src/vars');
const E = require('../../functions/explore');
const { executeAttack } = require('../../functions/attack');
const { recordProgress, completedLines } = require('../../functions/quests');

const REFUSALS = {
	unknown: 'There is no such place in Eldelvain.',
	here: 'You are already there.',
};

const searchKey = (guildId, userId) => `explore-search:${guildId}:${userId}`;

const percent = (bonus) => (bonus ? ` · +${Math.round(bonus * 100)}% rewards` : '');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('explore')
		.setDescription('Explore Eldelvain.')
		.addSubcommand((subcommand) =>
			subcommand.setName('map').setDescription('See where you are and where you can go.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('travel')
				.setDescription('Travel to a place you have unlocked.')
				.addStringOption((option) =>
					option.setName('to').setDescription('Where to go.').setRequired(true).setAutocomplete(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('search').setDescription('Search where you are. Who knows what you will find?'),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;
		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) {
			throw new Error('profile not found');
		}

		const subcommand = options.getSubcommand();

		if (subcommand === 'map') {
			const here = (await E.currentLocation(player.accountID)) ?? E.LOCATIONS[0];
			const lines = E.LOCATIONS.map((location) => {
				if (location.name === here.name) return `📍 **${location.name}**${percent(location.rewardBonus)}`;
				if (location.unlockLevel <= player.level) return `▫️ ${location.name}${percent(location.rewardBonus)}`;
				return `🔒 ${location.name} (level ${location.unlockLevel})`;
			});
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle('🗺️ ELDELVAIN')
				.setDescription(`**You are at ${here.name}.**\n${here.description}\n\n${lines.join('\n')}`)
				.setFooter(footer);
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		if (subcommand === 'travel') {
			const result = await E.travel(player.accountID, options.getString('to'));
			if (!result.ok) {
				const content = result.reason === 'locked'
					? `${result.location.name} opens at level ${result.location.unlockLevel}.`
					: REFUSALS[result.reason];
				return interaction.reply({ content, flags: 64 });
			}
			const discovery = result.discovered ? `\n\n✨ **New place discovered!** +${result.bonus} IURA` : '';
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle(`🧭 You arrive at ${result.location.name}`)
				.setDescription(`${result.location.description}${discovery}\n\nMonsters you fight with /attack now come from here.`);
			return interaction.reply({ embeds: [embed] });
		}

		if (subcommand === 'search') {
			const key = searchKey(guild.id, member.id);
			const claimed = await redis.set(key, Date.now() + E.SEARCH_COOLDOWN, 'PX', E.SEARCH_COOLDOWN, 'NX');
			if (!claimed) {
				const remaining = Math.max(Number(await redis.get(key)) - Date.now(), 0);
				return interaction.reply({ content: `You have searched here recently. Look again in ${ms(remaining)}.`, flags: 64 });
			}

			let found;
			try {
				found = await E.search(player);
			}
			catch (error) {
				// a search that broke shouldn't cost the cooldown
				await redis.del(key);
				throw error;
			}
			const quests = completedLines(await recordProgress(player.accountID, 'search'));

			if (found.type === 'ambush') {
				await executeAttack(interaction, { ambush: true });
				if (quests.length) await interaction.followUp({ content: quests.join('\n'), flags: 64 });
				return;
			}

			const text = {
				item: `You dig through the rubble and find **${found.item}**! 🎁`,
				iura: `You find a pouch someone left behind: **${found.amount} IURA**. 💰`,
				lore: `📜 ${found.text}`,
				nothing: 'You search carefully, but find nothing this time.',
			}[found.type];
			const embed = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setTitle(`🔎 Searching ${found.location.name}`)
				.setDescription([text, ...quests].join('\n\n'));
			return interaction.reply({ embeds: [embed] });
		}
	},
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused().toLowerCase();
		const player = await Player.findOne({ where: { discordID: interaction.user.id, guildID: interaction.guildId } });
		const level = player?.level ?? 1;
		await interaction.respond(E.unlockedFor(level)
			.filter((location) => location.name.toLowerCase().includes(focused))
			.slice(0, 25)
			.map((location) => ({ name: location.name, value: location.name })));
	},
};
