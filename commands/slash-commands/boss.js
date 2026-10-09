const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, channelMention } = require('discord.js');
const ms = require('ms');
const redis = require('../../redis');
const { Guild, Player } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { syncFaction } = require('../../functions/factions');
const {
	SOLO_COOLDOWN,
	MIN_AUTOSPAWN_HOURS,
	MAX_AUTOSPAWN_HOURS,
	isInFight,
	hasGroupFightIn,
	runBossFight,
	channelIO,
	configureAutoSpawn,
} = require('../../functions/boss');

const MOD_ONLY = 'You need the Moderate Members permission to do that.';

const soloCooldownKey = (guildId, userId) => `boss-solo:${guildId}:${userId}`;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('boss')
		.setDescription('Boss fights.')
		.addSubcommand((subcommand) =>
			subcommand.setName('challenge').setDescription('Challenge a boss on your own.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('spawn')
				.setDescription('(Moderators) Summon a world boss for everyone in this channel.')
				.addStringOption((option) =>
					option.setName('intro').setDescription('Story text shown when the boss appears.').setMaxLength(1000),
				)
				.addIntegerOption((option) =>
					option.setName('join_minutes').setDescription('How long fighters can join (default 2).').setMinValue(1).setMaxValue(10),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('autospawn')
				.setDescription('(Moderators) Let world bosses appear on their own.')
				.addIntegerOption((option) =>
					option.setName('hours')
						.setDescription(`About how often, in hours (${MIN_AUTOSPAWN_HOURS}-${MAX_AUTOSPAWN_HOURS}); 0 turns it off.`)
						.setMinValue(0)
						.setMaxValue(MAX_AUTOSPAWN_HOURS)
						.setRequired(true),
				)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where bosses appear (default: this channel).').addChannelTypes(ChannelType.GuildText),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { guild, user, options } = interaction;
		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasBosses')) {
			return;
		}

		const subcommand = options.getSubcommand();
		const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers);

		if (subcommand === 'challenge') {
			const player = await Player.findOne({ where: { discordID: user.id, guildID: guild.id } });
			if (!player) throw new Error('profile not found');
			// the faction bonus follows the member's faction role, as in /attack
			await syncFaction(player, guildCheck, interaction.member);
			if (isInFight(guild.id, user.id)) {
				return interaction.reply({ content: 'You are already in a boss fight.', flags: 64 });
			}

			const key = soloCooldownKey(guild.id, user.id);
			const claimed = await redis.set(key, Date.now() + SOLO_COOLDOWN, 'PX', SOLO_COOLDOWN, 'NX');
			if (!claimed) {
				const remaining = Math.max(Number(await redis.get(key)) - Date.now(), 0);
				return interaction.reply({ content: `You are still recovering from your last boss. Try again in ${ms(remaining)}.`, flags: 64 });
			}

			await interaction.deferReply();
			try {
				await runBossFight({
					kind: 'solo',
					guildID: guild.id,
					channelID: interaction.channelId,
					player,
					io: {
						show: (embed, components) => interaction.editReply({ embeds: [embed], components }),
						wait: require('node:timers/promises').setTimeout,
					},
				});
			}
			catch (error) {
				// a fight that broke shouldn't cost the cooldown
				await redis.del(key);
				throw error;
			}
			return;
		}

		if (!isMod) {
			return interaction.reply({ content: MOD_ONLY, flags: 64 });
		}

		if (subcommand === 'spawn') {
			if (hasGroupFightIn(interaction.channelId)) {
				return interaction.reply({ content: 'A world boss is already fighting in this channel.', flags: 64 });
			}
			await interaction.reply({ content: 'The boss is on its way…', flags: 64 });
			// the fight outlives this command: errors go to the log, not the (finished) reply
			runBossFight({
				kind: 'group',
				guildID: guild.id,
				channelID: interaction.channelId,
				intro: options.getString('intro') ?? undefined,
				joinMs: (options.getInteger('join_minutes') ?? 2) * 60 * 1000,
				io: channelIO(interaction.channel),
			}).catch((error) => console.error(`Boss fight in ${guild.id} failed:`, error));
			return;
		}

		if (subcommand === 'autospawn') {
			const hours = options.getInteger('hours');
			if (hours && hours < MIN_AUTOSPAWN_HOURS) {
				return interaction.reply({ content: `Use at least ${MIN_AUTOSPAWN_HOURS} hour, or 0 to turn it off.`, flags: 64 });
			}
			const channel = options.getChannel('channel') ?? interaction.channel;
			const delay = await configureAutoSpawn(interaction.client.bossQueue, guild.id, channel.id, hours);
			return interaction.reply({
				content: delay === null
					? 'World bosses will no longer appear on their own.'
					: `World bosses will appear in ${channelMention(channel.id)} about every ${hours} hour(s). The next one comes in about ${ms(delay)}.`,
				flags: 64,
			});
		}
	},
};
