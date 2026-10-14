const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Player, Item, Shop } = require('../../src/db');
const { footer } = require('../../src/vars');
const buttonPages = require('../../functions/paginator');
const C = require('../../functions/crafting');

const PER_PAGE = 5;

const statLine = (shopItem) => [
	shopItem.totalAttack && `ATK ${shopItem.totalAttack}`,
	shopItem.totalDefense && `DEF ${shopItem.totalDefense}`,
	shopItem.totalHealth && `HP ${shopItem.totalHealth}`,
].filter(Boolean).join(' · ');

const showRecipes = async (interaction, player) => {
	await interaction.deferReply({ flags: 64 });
	const owned = new Map((await Item.findAll({ where: { accountID: player.accountID } })).map((item) => [item.itemName, item.quantity]));
	const outputs = new Map((await Shop.findAll({ where: { guildID: null, item_ID: C.recipes.map((r) => r.item_ID) } })).map((s) => [s.item_ID, s]));

	const pages = [];
	for (let i = 0; i < C.recipes.length; i += PER_PAGE) {
		const embed = new EmbedBuilder()
			.setColor(0xcd7f32)
			.setTitle('🛠️ RECIPES')
			.setDescription('Craft with `/craft make`. Crafted items can\'t be bought.')
			.setFooter(footer);
		for (const recipe of C.recipes.slice(i, i + PER_PAGE)) {
			const output = outputs.get(recipe.item_ID);
			if (!output) continue;
			const inputs = recipe.inputs.map((input) => {
				const have = owned.get(input.item) ?? 0;
				return `${have >= input.amount ? '✅' : '▫️'} ${input.item}: ${have}/${input.amount}`;
			});
			embed.addFields({
				name: `${output.itemName} (\`${output.item_ID}\`) · Level ${recipe.level}`,
				value: [statLine(output) || output.description, ...inputs, `💰 ${recipe.iura} IURA`].join('\n').slice(0, 1024),
			});
		}
		pages.push(embed);
	}
	await buttonPages(interaction, pages);
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('craft')
		.setDescription('Craft gear and supplies from materials.')
		.addSubcommand((subcommand) =>
			subcommand.setName('recipes').setDescription('See every recipe and what you have for it.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('make')
				.setDescription('Craft an item.')
				.addStringOption((option) =>
					option.setName('recipe').setDescription('What to craft.').setRequired(true).setAutocomplete(true),
				)
				.addIntegerOption((option) =>
					option.setName('amount').setDescription('How many (default 1).').setMinValue(1).setMaxValue(100),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild, options } = interaction;
		const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id } });
		if (!player) throw new Error('profile not found');

		if (options.getSubcommand() === 'recipes') return showRecipes(interaction, player);

		const result = await C.craftItem(player.accountID, options.getString('recipe'), options.getInteger('amount') ?? 1);
		if (!result.ok) {
			const content = {
				'amount': 'Craft between 1 and 100 at a time.',
				'unknown': 'There is no such recipe. Pick one from the list.',
				'level': `You need to be level ${result.level} to craft that.`,
				'materials': `You're missing:\n${(result.missing ?? []).map((m) => `- ${m.item}: ${m.have}/${m.need}`).join('\n')}`,
				'iura': `You need **${result.iura} IURA** to craft that.`,
			}[result.reason];
			return interaction.reply({ content, flags: 64 });
		}
		await interaction.reply({ content: `🛠️ You crafted ${result.amount} × **${result.itemName}**.`, flags: 64 });
	},
	async autocomplete(interaction) {
		const focused = interaction.options.getFocused().toLowerCase();
		const outputs = await Shop.findAll({ where: { guildID: null, item_ID: C.recipes.map((r) => r.item_ID) } });
		const names = new Map(outputs.map((s) => [s.item_ID, s.itemName]));
		await interaction.respond(C.recipes
			.filter((r) => names.has(r.item_ID))
			.filter((r) => r.item_ID.startsWith(focused) || names.get(r.item_ID).toLowerCase().includes(focused))
			.slice(0, 25)
			.map((r) => ({ name: `${names.get(r.item_ID)} (level ${r.level})`, value: r.item_ID })));
	},
};
