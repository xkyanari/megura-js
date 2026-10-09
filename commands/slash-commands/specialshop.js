const { SlashCommandBuilder, PermissionFlagsBits, userMention } = require('discord.js');
const specialshop = require('../../functions/specialshop');
const { Guild, Shop, grantOres } = require('../../src/db');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('specialshop')
		.setDescription('Purchase Special items here!')
		.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
		.addSubcommand((subcommand) =>
			subcommand.setName('browse').setDescription('Display the items available for purchase.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('additem')
				.setDescription('Adds a new item in the Special shop.')
				.addStringOption(option =>
					option.setName('item')
						.setDescription('Enter the item name.')
						.setRequired(true),
				)
				.addIntegerOption(option =>
					option.setName('price')
						.setDescription('Enter the item price.')
						.setMinValue(1)
						.setRequired(true),
				)
				.addIntegerOption(option =>
					option.setName('stock')
						.setDescription('Set initial stock level.')
						.setMinValue(0)
						.setRequired(true),
				)
				.addStringOption(option =>
					option.setName('category')
						.setDescription('Enter the item ID. No spaces.')
						.setRequired(true)
						.addChoices(
							{ name: 'Whitelist', value: 'whitelist' },
							{ name: 'Event Items', value: 'events' },
							{ name: 'Digital Items', value: 'digital' },
							{ name: 'NFTs', value: 'nfts' },
							{ name: 'Cryptocurrencies', value: 'crypto' },
						),
				)
				.addStringOption(option =>
					option.setName('itemid')
						.setDescription('Enter the item ID. No spaces.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('removeitem')
				.setDescription('Removes an item from the Special shop.')
				.addStringOption(option =>
					option.setName('itemid')
						.setDescription('Enter the item ID. No spaces.')
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setprice')
				.setDescription('Sets the price for an item in the Special shop.')
				.addStringOption(option =>
					option.setName('itemid')
						.setDescription('Enter the item ID. No spaces.')
						.setRequired(true),
				)
				.addIntegerOption(option =>
					option.setName('price')
						.setDescription('Enter the item price.')
						.setMinValue(1)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('setstock')
				.setDescription('Sets the stock level for an item in the Special shop.')
				.addStringOption(option =>
					option.setName('itemid')
						.setDescription('Enter the item ID. No spaces.')
						.setRequired(true),
				)
				.addIntegerOption(option =>
					option.setName('stock')
						.setDescription('Enter stock amount.')
						.setMinValue(0)
						.setRequired(true),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('transfer')
				.setDescription('Give a certain amount of ORES token to a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('Select user.')
						.setRequired(true),
				)
				.addIntegerOption(option =>
					option.setName('amount')
						.setDescription('Enter amount.')
						.setMinValue(1)
						.setRequired(true),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { options } = interaction;
		const subCommand = options.getSubcommand();

		const oreEmoji = interaction.client.emojis.cache.get('1119212796136144956') || '💎';

		const item = options.getString('item');
		const price = options.getInteger('price');
		const stock = options.getInteger('stock');
		const itemID = options.getString('itemid');
		const category = options.getString('category');
		const recipient = options.getUser('user');
		const amount = options.getInteger('amount');

		const guild = await Guild.findOne({ where: { guildID: interaction.guild.id } });

		if (!guild) {
			throw new Error('guild not found');
		}

		switch (subCommand) {
			case 'browse':
				await specialshop(interaction);
				break;
			case 'additem': {
				await interaction.deferReply();
				if (!await Shop.addItem(item, price, stock, itemID, category, interaction.guild.id)) {
					return await interaction.editReply({ content: `An item with the ID \`${itemID}\` or the name \`${item}\` already exists. Pick a different one.` });
				}
				return await interaction.editReply({ content: `Item \`${item}\` added to the Special Shop.` });
			}
			case 'removeitem': {
				await interaction.deferReply();
				const getItem = await Shop.getItem(itemID, interaction.guild.id);

				if (!getItem) return await interaction.editReply({ content: 'Item not found.' });

				await Shop.removeItem(itemID, interaction.guild.id);
				return await interaction.editReply({ content: `Item \`${getItem.itemName}\` removed from the Special Shop.` });
			}
			case 'setprice': {
				await interaction.deferReply();
				const getItem = await Shop.getItem(itemID, interaction.guild.id);

				if (!getItem) return await interaction.editReply({ content: 'Item not found.' });

				await Shop.updateItem({ item_ID: itemID, guildID: interaction.guild.id, price });
				return await interaction.editReply({ content: `Item \`${getItem.itemName}\` updated. New price set is \`${price}\` ${oreEmoji}` });
			}
			case 'setstock': {
				await interaction.deferReply();
				const getItem = await Shop.getItem(itemID, interaction.guild.id);

				if (!getItem) return await interaction.editReply({ content: 'Item not found.' });

				await Shop.updateItem({ item_ID: itemID, guildID: interaction.guild.id, stock });
				return await interaction.editReply({ content: `Item \`${getItem.itemName}\` updated. New stock set is \`${stock}\`.` });
			}

			case 'transfer': {
				await interaction.deferReply();
				try {
					await grantOres(recipient.id, interaction.guild.id, amount);
				}
				catch (error) {
					if (error.message === 'insufficient funds') {
						return await interaction.editReply({ content: `The server wallet doesn't have \`${amount}\` ${oreEmoji} to give.` });
					}
					throw error;
				}
				return await interaction.editReply({ content: `\`${amount}\` ${oreEmoji} has been transferred to ${userMention(recipient.id)}.` });
			}
		}

	},
};
