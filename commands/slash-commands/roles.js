const { SlashCommandBuilder, ChannelType, EmbedBuilder, channelMention, roleMention } = require('discord.js');
const { Guild, RolePanel, RolePanelRole } = require('../../src/db');
const { validateFeature } = require('../../src/feature');
const { logSetupChange } = require('../../functions/logs');
const {
	MAX_ROLES,
	REFUSALS,
	isValidEmoji,
	assignRefusal,
	outranks,
	findPanel,
	panelRoles,
	panelMessage,
	fetchPanelMessage,
	refreshPanel,
} = require('../../functions/rolePanel');

const panelOption = (option) => option
	.setName('panel')
	.setDescription('Panel ID (see /roles list).')
	.setMinValue(1)
	.setRequired(true);

const roleOption = (option) => option
	.setName('role')
	.setDescription('The role.')
	.setRequired(true);

const ephemeral = (interaction, content) =>
	interaction.reply({ content, flags: 64, allowedMentions: { parse: [] } });

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roles')
		.setDescription('Button role panels: members click a button to get or remove a role.')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('create')
				.setDescription('Create a role panel.')
				.addStringOption((option) =>
					option.setName('title').setDescription('Panel title.').setMaxLength(256).setRequired(true),
				)
				.addStringOption((option) =>
					option.setName('description').setDescription('Text shown above the roles.').setMaxLength(1024),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('add')
				.setDescription(`Add a role to a panel (up to ${MAX_ROLES}), or change its button.`)
				.addIntegerOption(panelOption)
				.addRoleOption(roleOption)
				.addStringOption((option) =>
					option.setName('label').setDescription('Button text (default: the role name).').setMaxLength(80),
				)
				.addStringOption((option) =>
					option.setName('emoji').setDescription('Button emoji, e.g. 🎮 or a server emoji.').setMaxLength(100),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('remove')
				.setDescription('Remove a role from a panel.')
				.addIntegerOption(panelOption)
				.addRoleOption(roleOption),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('post')
				.setDescription('Post a panel in a channel.')
				.addIntegerOption(panelOption)
				.addChannelOption((option) =>
					option.setName('channel').setDescription('Where to post it (default: this channel).').addChannelTypes(ChannelType.GuildText),
				),
		)
		.addSubcommand((subcommand) =>
			subcommand.setName('list').setDescription('Show this server\'s role panels.'),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('delete')
				.setDescription('Delete a panel and its posted message.')
				.addIntegerOption(panelOption),
		)
		.setDefaultMemberPermissions('0'),
	cooldown: 3000,
	async execute(interaction) {
		const { options, guild, client } = interaction;

		const guildCheck = await Guild.findOne({ where: { guildID: guild.id } });
		if (!guildCheck) {
			throw new Error('guild not found');
		}
		if (!await validateFeature(interaction, guildCheck.subscription, 'hasButtonRoles')) {
			return;
		}

		const subcommand = options.getSubcommand();

		if (subcommand === 'create') {
			const panel = await RolePanel.create({
				guildID: guild.id,
				title: options.getString('title'),
				description: options.getString('description'),
			});
			await ephemeral(interaction, `Created role panel **#${panel.id}**. Add roles with \`/roles add panel:${panel.id}\`, then post it with \`/roles post\`.`);
			await logSetupChange(interaction, 'created a role panel', [
				{ name: 'ID', value: panel.id },
				{ name: 'Title', value: panel.title },
			]);
			return;
		}

		if (subcommand === 'list') {
			const panels = await RolePanel.findAll({ where: { guildID: guild.id }, order: [['id', 'ASC']], limit: 25 });
			const lines = await Promise.all(panels.map(async (panel) => {
				const count = await RolePanelRole.count({ where: { panelId: panel.id } });
				const where = panel.channelID ? `posted in ${channelMention(panel.channelID)}` : 'not posted';
				return `**#${panel.id}** ${panel.title}: ${count} role${count === 1 ? '' : 's'}, ${where}`;
			}));
			const embed = new EmbedBuilder()
				.setTitle('Role panels')
				.setColor(0x5865f2)
				.setDescription(lines.length ? lines.join('\n') : 'No role panels yet. Create one with `/roles create`.');
			return interaction.reply({ embeds: [embed], flags: 64 });
		}

		const id = options.getInteger('panel');
		const panel = await findPanel(id, guild.id);
		if (!panel) {
			return ephemeral(interaction, `There's no role panel #${id} in this server.`);
		}

		if (subcommand === 'add') {
			const role = options.getRole('role');
			const emoji = options.getString('emoji')?.trim() || null;

			const refusal = assignRefusal(guild, role);
			if (refusal) {
				return ephemeral(interaction, REFUSALS[refusal]);
			}
			if (!outranks(interaction.member, role, guild)) {
				return ephemeral(interaction, 'You can only add roles that are below your own highest role.');
			}
			if (emoji && !isValidEmoji(emoji)) {
				return ephemeral(interaction, 'That doesn\'t look like an emoji. Use a single emoji like 🎮, or a server emoji.');
			}

			const label = options.getString('label') ?? role.name.slice(0, 80);
			const existing = await RolePanelRole.findOne({ where: { panelId: panel.id, roleId: role.id } });
			if (existing) {
				await existing.update({ label, emoji });
			}
			else {
				if (await RolePanelRole.count({ where: { panelId: panel.id } }) >= MAX_ROLES) {
					return ephemeral(interaction, `A panel can hold up to ${MAX_ROLES} roles. Create another panel for more.`);
				}
				await RolePanelRole.create({ panelId: panel.id, roleId: role.id, label, emoji });
			}

			await interaction.deferReply({ flags: 64 });
			const updated = await refreshPanel(client, panel);
			await interaction.editReply({
				content: `${existing ? 'Updated' : 'Added'} ${roleMention(role.id)} on panel #${panel.id}.${updated ? ' The posted panel is updated.' : ''}`,
				allowedMentions: { parse: [] },
			});
			await logSetupChange(interaction, `${existing ? 'updated' : 'added'} a role on a role panel`, [
				{ name: 'Panel', value: panel.id },
				{ name: 'Role', value: role.name },
			]);
			return;
		}

		if (subcommand === 'remove') {
			const role = options.getRole('role');
			const removed = await RolePanelRole.destroy({ where: { panelId: panel.id, roleId: role.id } });
			if (!removed) {
				return ephemeral(interaction, `${roleMention(role.id)} isn't on panel #${panel.id}.`);
			}
			await interaction.deferReply({ flags: 64 });
			const updated = await refreshPanel(client, panel);
			await interaction.editReply({
				content: `Removed ${roleMention(role.id)} from panel #${panel.id}.${updated ? ' The posted panel is updated.' : ''}`,
				allowedMentions: { parse: [] },
			});
			await logSetupChange(interaction, 'removed a role from a role panel', [
				{ name: 'Panel', value: panel.id },
				{ name: 'Role', value: role.name },
			]);
			return;
		}

		if (subcommand === 'post') {
			const roles = await panelRoles(panel.id);
			if (!roles.length) {
				return ephemeral(interaction, `Panel #${panel.id} has no roles yet. Add some with \`/roles add\`.`);
			}
			const channel = options.getChannel('channel') ?? interaction.channel;
			await interaction.deferReply({ flags: 64 });

			// one live copy per panel: take down the previous post
			const previous = await fetchPanelMessage(client, panel);
			const message = await channel.send(panelMessage(panel, roles));
			await previous?.delete().catch(() => null);
			await panel.update({ channelID: channel.id, messageID: message.id });

			await interaction.editReply(`Posted panel #${panel.id} in ${channelMention(channel.id)}.`);
			return;
		}

		if (subcommand === 'delete') {
			await interaction.deferReply({ flags: 64 });
			const message = await fetchPanelMessage(client, panel);
			await message?.delete().catch(() => null);
			await RolePanelRole.destroy({ where: { panelId: panel.id } });
			await panel.destroy();
			await interaction.editReply(`Deleted role panel #${panel.id}.`);
			await logSetupChange(interaction, 'deleted a role panel', [
				{ name: 'ID', value: panel.id },
				{ name: 'Title', value: panel.title },
			]);
		}
	},
};
