const { SlashCommandBuilder, ChannelType, EmbedBuilder, channelMention } = require('discord.js');
const ms = require('ms');
const { Guild, Raffle } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { logSetupChange } = require('../../functions/logs');
const { MIN_DURATION, MAX_DURATION, MAX_WINNERS } = require('../../functions/giveaway');
const {
	MAX_TICKET_PRICE,
	MAX_TICKETS_PER_USER,
	currencyName,
	createRaffle,
	endRaffle,
	rerollRaffle,
	cancelRaffle,
	raffleEmbed,
	buyButton,
	announceRaffleEnd,
	announceRaffleReroll,
	announceRaffleCancel,
} = require('../../functions/raffle');

const idOption = (option) => option
	.setName('id')
	.setDescription('Raffle ID (shown under each raffle).')
	.setMinValue(1)
	.setRequired(true);

// Removes the scheduled end of a raffle that was ended or cancelled early.
const unscheduleEnd = async (client, raffleId) => {
	const job = await client.raffleQueue?.getJob(`raffle-${raffleId}`).catch(() => null);
	await job?.remove().catch(() => null);
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('raffle')
		.setDescription('Run raffles with tickets paid in IURA or ores.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('start')
				.setDescription('Start a raffle.')
				.addStringOption((option) =>
					option.setName('prize').setDescription('What the winners get.').setMaxLength(256).setRequired(true),
				)
				.addStringOption((option) =>
					option.setName('duration').setDescription('How long it runs, e.g. 30m, 12h, 3d (1 minute to 30 days).').setRequired(true),
				)
				.addStringOption((option) =>
					option
						.setName('currency')
						.setDescription('What tickets are paid with.')
						.addChoices({ name: 'IURA', value: 'iura' }, { name: 'Ores', value: 'ores' })
						.setRequired(true),
				)
				.addIntegerOption((option) =>
					option.setName('price').setDescription('Price of one ticket.').setMinValue(1).setMaxValue(MAX_TICKET_PRICE).setRequired(true),
				)
				.addIntegerOption((option) =>
					option.setName('winners').setDescription('Number of winners (default 1).').setMinValue(1).setMaxValue(MAX_WINNERS),
				)
				.addIntegerOption((option) =>
					option.setName('max_tickets').setDescription('Most tickets one member can buy (default 10).').setMinValue(1).setMaxValue(MAX_TICKETS_PER_USER),
				)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to post it (default: this channel).').addChannelTypes(ChannelType.GuildText),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('end').setDescription('End a raffle now and draw the winners.').addIntegerOption(idOption),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('reroll')
				.setDescription('Draw new winners for an ended raffle.')
				.addIntegerOption(idOption)
				.addIntegerOption((option) =>
					option.setName('winners').setDescription('How many to draw (default 1).').setMinValue(1).setMaxValue(MAX_WINNERS),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('cancel').setDescription('Cancel a running raffle and refund every ticket.').addIntegerOption(idOption),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('Show the running raffles.'),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { options, guild, client } = interaction;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasRaffles')) {
			return;
		}

		const subcommand = options.getSubcommand();

		if (subcommand === 'list') {
			const running = await Raffle.findAll({
				where: { guildID: guild.id, status: 'running' },
				order: [['endsAt', 'ASC']],
				limit: 25,
			});
			const lines = running.map((r) =>
				`**#${r.id}** ${r.prize} (${r.ticketPrice} ${currencyName(r.currency)}/ticket) in ${channelMention(r.channelID)}, ends <t:${Math.floor(r.endsAt.getTime() / 1000)}:R>`);
			const embed = new EmbedBuilder()
				.setTitle('Running raffles')
				.setColor(0xcd7f32)
				.setDescription(lines.length ? lines.join('\n') : 'No raffles are running.');
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		if (subcommand === 'start') {
			const prize = options.getString('prize');
			const duration = ms(options.getString('duration').trim());
			const channel = options.getChannel('channel') ?? interaction.channel;

			if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
				return interaction.reply({
					content: 'Please give a duration between 1 minute and 30 days, like `30m`, `12h` or `3d`.',
					flags: 64,
				});
			}

			await interaction.deferReply({ flags: 64 });

			const raffle = await createRaffle({
				guildID: guild.id,
				channelID: channel.id,
				hostID: interaction.user.id,
				prize,
				winnerCount: options.getInteger('winners') ?? 1,
				currency: options.getString('currency'),
				ticketPrice: options.getInteger('price'),
				maxTicketsPerUser: options.getInteger('max_tickets') ?? 10,
				endsAt: new Date(Date.now() + duration),
			});

			let message;
			try {
				message = await channel.send({ embeds: [raffleEmbed(raffle)], components: [buyButton(raffle)] });
			}
			catch (error) {
				// nobody can see it, so don't leave it running
				await raffle.destroy();
				throw error;
			}
			await raffle.update({ messageID: message.id });

			try {
				await client.raffleQueue.add(
					{ raffleId: raffle.id },
					{ jobId: `raffle-${raffle.id}`, delay: duration, removeOnComplete: true },
				);
			}
			catch (error) {
				// the raffle is already posted; the next bot start re-schedules its end
				console.error(`Could not schedule raffle ${raffle.id}:`, error);
			}

			await interaction.editReply(`Raffle **#${raffle.id}** started in ${channelMention(channel.id)}.`);
			await logSetupChange(interaction, 'started a raffle', [
				{ name: 'ID', value: raffle.id },
				{ name: 'Prize', value: prize },
				{ name: 'Ticket', value: `${raffle.ticketPrice} ${currencyName(raffle.currency)}` },
			]);
			return;
		}

		const id = options.getInteger('id');
		const raffle = await Raffle.findOne({ where: { id, guildID: guild.id } });
		if (!raffle) {
			return interaction.reply({ content: `There's no raffle #${id} in this server.`, flags: 64 });
		}

		if (subcommand === 'end') {
			const result = await endRaffle(id);
			if (!result) {
				return interaction.reply({ content: `Raffle #${id} isn't running.`, flags: 64 });
			}
			await unscheduleEnd(client, id);
			await interaction.reply({ content: `Raffle #${id} ended.`, flags: 64 });
			await announceRaffleEnd(client, result);
			return;
		}

		if (subcommand === 'reroll') {
			const result = await rerollRaffle(id, options.getInteger('winners') ?? 1);
			if (!result) {
				return interaction.reply({ content: `Raffle #${id} hasn't ended yet.`, flags: 64 });
			}
			await interaction.reply({
				content: result.winners.length ? `Rerolled raffle #${id}.` : `Everyone with a ticket for raffle #${id} has already won.`,
				flags: 64,
			});
			await announceRaffleReroll(client, result);
			return;
		}

		if (subcommand === 'cancel') {
			await interaction.deferReply({ flags: 64 });
			const result = await cancelRaffle(id);
			if (!result) {
				return interaction.editReply(`Raffle #${id} isn't running.`);
			}
			await unscheduleEnd(client, id);
			const missing = result.unrefunded
				? ` ${result.unrefunded} member(s) no longer have a profile, so their tickets couldn't be refunded.`
				: '';
			await interaction.editReply(`Raffle #${id} cancelled. Refunded ${result.refunded} member(s).${missing}`);
			await announceRaffleCancel(client, result);
			await logSetupChange(interaction, 'cancelled a raffle', [{ name: 'ID', value: id }]);
		}
	},
};
