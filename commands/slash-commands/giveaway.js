const { SlashCommandBuilder, ChannelType, EmbedBuilder, channelMention } = require('discord.js');
const ms = require('ms');
const { Guild, Giveaway } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { logSetupChange } = require('../../functions/logs');
const {
	MIN_DURATION,
	MAX_DURATION,
	MAX_WINNERS,
	createGiveaway,
	endGiveaway,
	rerollGiveaway,
	cancelGiveaway,
	giveawayEmbed,
	enterButton,
	announceGiveawayEnd,
	announceReroll,
	announceCancel,
} = require('../../functions/giveaway');

const idOption = (option) => option
	.setName('id')
	.setDescription('Giveaway ID (shown under each giveaway).')
	.setMinValue(1)
	.setRequired(true);

// Removes the scheduled end of a giveaway that was ended or cancelled early.
const unscheduleEnd = async (client, giveawayId) => {
	const job = await client.giveawayQueue?.getJob(`giveaway-${giveawayId}`).catch(() => null);
	await job?.remove().catch(() => null);
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('giveaway')
		.setDescription('Run giveaways in this server.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('start')
				.setDescription('Start a giveaway.')
				.addStringOption((option) =>
					option.setName('prize').setDescription('What the winners get.').setMaxLength(256).setRequired(true),
				)
				.addStringOption((option) =>
					option.setName('duration').setDescription('How long it runs, e.g. 30m, 12h, 3d (1 minute to 30 days).').setRequired(true),
				)
				.addIntegerOption((option) =>
					option.setName('winners').setDescription('Number of winners (default 1).').setMinValue(1).setMaxValue(MAX_WINNERS),
				)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to post it (default: this channel).').addChannelTypes(ChannelType.GuildText),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('end').setDescription('End a giveaway now and draw the winners.').addIntegerOption(idOption),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('reroll')
				.setDescription('Draw new winners for an ended giveaway.')
				.addIntegerOption(idOption)
				.addIntegerOption((option) =>
					option.setName('winners').setDescription('How many to draw (default 1).').setMinValue(1).setMaxValue(MAX_WINNERS),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('cancel').setDescription('Cancel a running giveaway without drawing.').addIntegerOption(idOption),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('Show the running giveaways.'),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { options, guild, client } = interaction;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasGiveaways')) {
			return;
		}

		const subcommand = options.getSubcommand();

		if (subcommand === 'list') {
			const running = await Giveaway.findAll({
				where: { guildID: guild.id, status: 'running' },
				order: [['endsAt', 'ASC']],
				limit: 25,
			});
			const lines = running.map((g) =>
				`**#${g.id}** ${g.prize} in ${channelMention(g.channelID)}, ends <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`);
			const embed = new EmbedBuilder()
				.setTitle('Running giveaways')
				.setColor(0xcd7f32)
				.setDescription(lines.length ? lines.join('\n') : 'No giveaways are running.');
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		if (subcommand === 'start') {
			const prize = options.getString('prize');
			const duration = ms(options.getString('duration').trim());
			const winnerCount = options.getInteger('winners') ?? 1;
			const channel = options.getChannel('channel') ?? interaction.channel;

			if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
				return interaction.reply({
					content: 'Please give a duration between 1 minute and 30 days, like `30m`, `12h` or `3d`.',
					flags: 64,
				});
			}

			await interaction.deferReply({ flags: 64 });

			const giveaway = await createGiveaway({
				guildID: guild.id,
				channelID: channel.id,
				hostID: interaction.user.id,
				prize,
				winnerCount,
				endsAt: new Date(Date.now() + duration),
			});

			let message;
			try {
				message = await channel.send({ embeds: [giveawayEmbed(giveaway)], components: [enterButton(giveaway)] });
			}
			catch (error) {
				// nobody can see it, so don't leave it running
				await giveaway.destroy();
				throw error;
			}
			await giveaway.update({ messageID: message.id });

			try {
				await client.giveawayQueue.add(
					{ giveawayId: giveaway.id },
					{ jobId: `giveaway-${giveaway.id}`, delay: duration, removeOnComplete: true },
				);
			}
			catch (error) {
				// the giveaway is already posted; the next bot start re-schedules its end
				console.error(`Could not schedule giveaway ${giveaway.id}:`, error);
			}

			await interaction.editReply(`Giveaway **#${giveaway.id}** started in ${channelMention(channel.id)}.`);
			await logSetupChange(interaction, 'started a giveaway', [
				{ name: 'ID', value: giveaway.id },
				{ name: 'Prize', value: prize },
				{ name: 'Ends', value: `<t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:f>`, text: giveaway.endsAt.toISOString() },
			]);
			return;
		}

		const id = options.getInteger('id');
		const giveaway = await Giveaway.findOne({ where: { id, guildID: guild.id } });
		if (!giveaway) {
			return interaction.reply({ content: `There's no giveaway #${id} in this server.`, flags: 64 });
		}

		if (subcommand === 'end') {
			const result = await endGiveaway(id);
			if (!result) {
				return interaction.reply({ content: `Giveaway #${id} isn't running.`, flags: 64 });
			}
			await unscheduleEnd(client, id);
			await interaction.reply({ content: `Giveaway #${id} ended.`, flags: 64 });
			await announceGiveawayEnd(client, result);
			return;
		}

		if (subcommand === 'reroll') {
			const result = await rerollGiveaway(id, options.getInteger('winners') ?? 1);
			if (!result) {
				return interaction.reply({ content: `Giveaway #${id} hasn't ended yet.`, flags: 64 });
			}
			await interaction.reply({
				content: result.winners.length ? `Rerolled giveaway #${id}.` : `Everyone who entered giveaway #${id} has already won.`,
				flags: 64,
			});
			await announceReroll(client, result);
			return;
		}

		if (subcommand === 'cancel') {
			const cancelled = await cancelGiveaway(id);
			if (!cancelled) {
				return interaction.reply({ content: `Giveaway #${id} isn't running.`, flags: 64 });
			}
			await unscheduleEnd(client, id);
			await interaction.reply({ content: `Giveaway #${id} cancelled.`, flags: 64 });
			await announceCancel(client, cancelled);
			await logSetupChange(interaction, 'cancelled a giveaway', [{ name: 'ID', value: id }]);
		}
	},
};
