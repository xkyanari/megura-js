const { SlashCommandBuilder, ChannelType, EmbedBuilder, channelMention } = require('discord.js');
const { Guild, Form, FormField } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { logSetupChange } = require('../../functions/logs');
const {
	MAX_FIELDS,
	findForm,
	formFields,
	fillButton,
	formEmbed,
	canPostIn,
	fetchFormMessage,
} = require('../../functions/form');

const formOption = (option) => option
	.setName('form')
	.setDescription('Form ID (see /form list).')
	.setMinValue(1)
	.setRequired(true);

const ephemeral = (interaction, content) => interaction.reply({ content, flags: 64 });

const cantPost = (channel) =>
	`I can't post in ${channelMention(channel.id)}. I need **View Channel**, **Send Messages** and **Embed Links** there.`;

const describeFields = (fields) => fields
	.map((f, i) => `${i + 1}. **${f.label}** (${f.style}${f.required ? ', required' : ''})`)
	.join('\n');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('form')
		.setDescription('Forms members fill in with a button; answers are posted to a channel.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('create')
				.setDescription('Create a form.')
				.addStringOption((option) =>
					option.setName('title').setDescription('Form title (up to 45 characters).').setMaxLength(45).setRequired(true),
				)
				.addChannelOption((option) =>
					option.setName('responses').setDescription('Where answers are posted.').addChannelTypes(ChannelType.GuildText).setRequired(true),
				)
				.addStringOption((option) =>
					option.setName('description').setDescription('Text shown above the Fill in button.').setMaxLength(1024),
				),
		)
		.addSubcommandGroup((group) =>
			group
				.setName('field')
				.setDescription('Questions on a form.')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription(`Add a question (up to ${MAX_FIELDS} per form).`)
						.addIntegerOption(formOption)
						.addStringOption((option) =>
							option.setName('label').setDescription('The question (up to 45 characters).').setMaxLength(45).setRequired(true),
						)
						.addStringOption((option) =>
							option
								.setName('style')
								.setDescription('Answer box (default: short).')
								.addChoices({ name: 'Short (one line)', value: 'short' }, { name: 'Paragraph', value: 'paragraph' }),
						)
						.addBooleanOption((option) =>
							option.setName('required').setDescription('Must it be answered? (default: yes)'),
						)
						.addStringOption((option) =>
							option.setName('placeholder').setDescription('Hint shown in the empty box.').setMaxLength(100),
						),
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('remove')
						.setDescription('Remove a question.')
						.addIntegerOption(formOption)
						.addIntegerOption((option) =>
							option.setName('number').setDescription('Question number (see /form list).').setMinValue(1).setMaxValue(MAX_FIELDS).setRequired(true),
						),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('post')
				.setDescription('Post a form\'s Fill in button.')
				.addIntegerOption(formOption)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to post it (default: this channel).').addChannelTypes(ChannelType.GuildText),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('Show this server\'s forms and their questions.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('delete')
				.setDescription('Delete a form and its posted button.')
				.addIntegerOption(formOption),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { options, guild, client } = interaction;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasForms')) {
			return;
		}

		const group = options.getSubcommandGroup(false);
		const subcommand = options.getSubcommand();

		if (subcommand === 'create') {
			const responses = options.getChannel('responses');
			if (!canPostIn(responses, guild)) {
				return ephemeral(interaction, cantPost(responses));
			}
			const form = await Form.create({
				guildID: guild.id,
				title: options.getString('title'),
				description: options.getString('description'),
				responseChannelID: responses.id,
			});
			await ephemeral(interaction, `Created form **#${form.id}**. Add questions with \`/form field add form:${form.id}\`, then post it with \`/form post\`.`);
			await logSetupChange(interaction, 'created a form', [
				{ name: 'ID', value: form.id },
				{ name: 'Title', value: form.title },
				{ name: 'Responses', value: channelMention(responses.id), text: `#${responses.name}` },
			]);
			return;
		}

		if (subcommand === 'list') {
			const forms = await Form.findAll({ where: { guildID: guild.id }, order: [['id', 'ASC']], limit: 10 });
			const embed = new EmbedBuilder().setTitle('Forms').setColor(0xcd7f32);
			if (!forms.length) {
				embed.setDescription('No forms yet. Create one with `/form create`.');
			}
			for (const form of forms) {
				const fields = await formFields(form.id);
				embed.addFields({
					name: `#${form.id} ${form.title}`,
					value: [
						`Answers go to ${channelMention(form.responseChannelID)}${form.channelID ? `, posted in ${channelMention(form.channelID)}` : ', not posted'}`,
						fields.length ? describeFields(fields) : '*No questions yet*',
					].join('\n'),
				});
			}
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		const id = options.getInteger('form');
		const form = await findForm(id, guild.id);
		if (!form) {
			return ephemeral(interaction, `There's no form #${id} in this server.`);
		}

		if (group === 'field' && subcommand === 'add') {
			if (await FormField.count({ where: { formId: form.id } }) >= MAX_FIELDS) {
				return ephemeral(interaction, `A form can have up to ${MAX_FIELDS} questions; that's all Discord's pop-ups hold.`);
			}
			const field = await FormField.create({
				formId: form.id,
				label: options.getString('label'),
				style: options.getString('style') ?? 'short',
				required: options.getBoolean('required') ?? true,
				placeholder: options.getString('placeholder'),
			});
			const fields = await formFields(form.id);
			await ephemeral(interaction, `Added question ${fields.length} to form #${form.id}:\n${describeFields(fields)}`);
			await logSetupChange(interaction, 'added a question to a form', [
				{ name: 'Form', value: form.id },
				{ name: 'Question', value: field.label },
			]);
			return;
		}

		if (group === 'field' && subcommand === 'remove') {
			const number = options.getInteger('number');
			const fields = await formFields(form.id);
			const field = fields[number - 1];
			if (!field) {
				return ephemeral(interaction, `Form #${form.id} has no question ${number}.`);
			}
			await field.destroy();
			const rest = fields.filter((f) => f.id !== field.id);
			await ephemeral(interaction, `Removed **${field.label}** from form #${form.id}.${rest.length ? `\n${describeFields(rest)}` : ''}`);
			await logSetupChange(interaction, 'removed a question from a form', [
				{ name: 'Form', value: form.id },
				{ name: 'Question', value: field.label },
			]);
			return;
		}

		if (subcommand === 'post') {
			if (!await FormField.count({ where: { formId: form.id } })) {
				return ephemeral(interaction, `Form #${form.id} has no questions yet. Add some with \`/form field add\`.`);
			}
			const channel = options.getChannel('channel') ?? interaction.channel;
			await interaction.deferReply({ flags: 64 });

			// one live copy per form: take down the previous post
			const previous = await fetchFormMessage(client, form);
			const message = await channel.send({ embeds: [formEmbed(form)], components: [fillButton(form)] });
			await previous?.delete().catch(() => null);
			await form.update({ channelID: channel.id, messageID: message.id });

			await interaction.editReply(`Posted form #${form.id} in ${channelMention(channel.id)}.`);
			return;
		}

		if (subcommand === 'delete') {
			await interaction.deferReply({ flags: 64 });
			const message = await fetchFormMessage(client, form);
			await message?.delete().catch(() => null);
			await FormField.destroy({ where: { formId: form.id } });
			await form.destroy();
			await interaction.editReply(`Deleted form #${form.id}.`);
			await logSetupChange(interaction, 'deleted a form', [
				{ name: 'ID', value: form.id },
				{ name: 'Title', value: form.title },
			]);
		}
	},
};
