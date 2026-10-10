const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Op } = require('sequelize');
const { sequelize, Player, Item, Iura, Exploration, QuestProgress, FactionContribution, Brawl, BossFight, Order } = require('../src/db');

async function requestDeletion(interaction) {
	const player = await Player.findOne({ where: { discordID: interaction.user.id, guildID: interaction.guild.id } });
	if (!player) throw new Error('profile not found');

	const modal = new ModalBuilder()
		.setCustomId(`profile-delete:${player.accountID}`)
		.setTitle('Permanently delete your voyager');
	modal.addComponents(
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('characterName')
				.setLabel('Type your character name to confirm')
				.setPlaceholder(player.playerName.slice(0, 100))
				.setStyle(TextInputStyle.Short)
				.setMinLength(1)
				.setMaxLength(100)
				.setRequired(true),
		),
		new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('confirmation')
				.setLabel('Lose gear, money and progress. Type DELETE')
				.setStyle(TextInputStyle.Short)
				.setMaxLength(6)
				.setRequired(true),
		),
	);
	return interaction.showModal(modal);
}

async function deleteProfile({ accountID, discordID, guildID, characterName, confirmation }) {
	if (!Number.isSafeInteger(accountID) || accountID <= 0 || confirmation !== 'DELETE') return { ok: false, reason: 'confirmation' };
	return sequelize.transaction(async (transaction) => {
		// Bind confirmation to this exact character, never a replacement created later.
		const player = await Player.findOne({
			where: { accountID, discordID, guildID }, transaction, lock: transaction.LOCK.UPDATE,
		});
		if (!player) return { ok: false, reason: 'missing' };
		if (player.playerName !== characterName) return { ok: false, reason: 'confirmation' };

		// Outstanding payouts use Discord IDs rather than character IDs.
		// Finish them before starting over so they cannot pay a replacement character.
		const pendingBrawl = await Brawl.findOne({
			where: { status: 'pending', [Op.or]: [{ challengerId: discordID }, { acceptorId: discordID }] }, transaction,
		});
		const runningBoss = await BossFight.findOne({ where: { guildID, status: 'running' }, transaction });
		const pendingOrder = await Order.findOne({ where: { guildID, discordID, status: 'pending' }, transaction });
		if (pendingBrawl || runningBoss || pendingOrder) return { ok: false, reason: 'pending' };

		for (const model of [Item, Iura, Exploration, QuestProgress, FactionContribution]) {
			await model.destroy({ where: { accountID }, transaction });
		}
		await player.destroy({ transaction });
		return { ok: true };
	});
}

module.exports = { requestDeletion, deleteProfile };
