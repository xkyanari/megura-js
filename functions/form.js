const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	ModalBuilder,
	PermissionFlagsBits,
	TextInputBuilder,
	TextInputStyle,
	userMention,
} = require('discord.js');
const { Form, FormField } = require('../src/db');

/**
 * Forms: an admin defines up to 5 questions; members click "Fill in" and
 * answer them in a Discord pop-up, and Dahlia posts the answers to the form's
 * response channel. Answers are not stored in the database.
 */

// Discord pop-ups hold at most 5 text inputs.
const MAX_FIELDS = 5;
// Each answer becomes an embed field, which holds up to 1024 characters.
const MAX_ANSWER = 1024;

const findForm = (id, guildID) => Form.findOne({ where: { id, guildID } });

const formFields = (formId) => FormField.findAll({ where: { formId }, order: [['id', 'ASC']] });

const inputId = (field) => `f${field.id}`;

const buildModal = (form, fields) => new ModalBuilder()
	.setCustomId(`form-submit:${form.id}`)
	.setTitle(form.title)
	.addComponents(fields.map((field) => {
		const input = new TextInputBuilder()
			.setCustomId(inputId(field))
			.setLabel(field.label)
			.setStyle(field.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
			.setRequired(field.required)
			.setMaxLength(MAX_ANSWER);
		if (field.placeholder) input.setPlaceholder(field.placeholder);
		return new ActionRowBuilder().addComponents(input);
	}));

const fillButton = (form) => new ActionRowBuilder().addComponents(
	new ButtonBuilder()
		.setCustomId(`form-open:${form.id}`)
		.setEmoji('📝')
		.setLabel('Fill in')
		.setStyle(ButtonStyle.Primary),
);

const formEmbed = (form) => new EmbedBuilder()
	.setTitle(form.title)
	.setColor(0xcd7f32)
	.setDescription(form.description || 'Click **Fill in** to answer.');

// Reads an answer, or null if the question was added after the member opened the form.
const answerFor = (fields, field) => {
	try {
		return fields.getTextInputValue(inputId(field));
	}
	catch {
		return null;
	}
};

const submissionEmbed = (form, fields, answers, user) => new EmbedBuilder()
	.setTitle(form.title)
	.setColor(0xcd7f32)
	.setAuthor({ name: user.tag ?? user.username, iconURL: user.displayAvatarURL?.() })
	.setDescription(`Submitted by ${userMention(user.id)}`)
	.addFields(fields.map((field) => ({
		name: field.label,
		value: answerFor(answers, field)?.trim() || '*No answer*',
	})))
	.setFooter({ text: `Form #${form.id} · User ID ${user.id}` })
	.setTimestamp();

// Whether Dahlia can post submissions in `channel`.
const canPostIn = (channel, guild) => Boolean(channel.permissionsFor(guild.members.me)?.has([
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.EmbedLinks,
]));

const fetchFormMessage = async (client, form) => {
	if (!form.channelID || !form.messageID) return null;
	const channel = await client.channels.fetch(form.channelID).catch(() => null);
	return channel ? channel.messages.fetch(form.messageID).catch(() => null) : null;
};

/**
 * Posts a submission to the form's response channel. Returns { ok: true } or
 * { ok: false, reason } with reason 'gone' (form deleted or emptied) or
 * 'no channel' (the response channel is missing).
 */
const submitForm = async (interaction, formId) => {
	const { guild, client, user } = interaction;
	const form = await findForm(formId, guild.id);
	const fields = form ? await formFields(form.id) : [];
	if (!fields.length) return { ok: false, reason: 'gone' };

	const channel = await client.channels.fetch(form.responseChannelID).catch(() => null);
	if (!channel) return { ok: false, reason: 'no channel' };

	await channel.send({
		embeds: [submissionEmbed(form, fields, interaction.fields, user)],
		allowedMentions: { parse: [] },
	});
	return { ok: true, form };
};

module.exports = {
	MAX_FIELDS,
	MAX_ANSWER,
	findForm,
	formFields,
	buildModal,
	fillButton,
	formEmbed,
	submissionEmbed,
	canPostIn,
	fetchFormMessage,
	submitForm,
};
