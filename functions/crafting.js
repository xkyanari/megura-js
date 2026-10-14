const { sequelize, Player, Item, Shop, moveIura } = require('../src/db');
const { statsFor } = require('./equipment');
const recipes = require('../assets/recipes.json');
const materials = require('../assets/materials.json');

/**
 * Gear upgrades, crafting and salvage.
 *
 * Materials come in tiers that follow item level (assets/materials.json):
 * metals upgrade weapons, hides and silks upgrade armor and accessories.
 * They drop from monsters, turn up when exploring, come from salvaged gear,
 * and the commonest are sold in the shop.
 *
 * Upgrades go from +0 to +5, each adding 10% of the item's base stats. The
 * higher steps can fail, and a failure from +3 up drops the item a level
 * unless a Ward Stone is used. An upgrade applies to every copy the player
 * owns of that item, and is lost when the last copy is sold or salvaged.
 *
 * Crafted items (assets/recipes.json) can't be bought, only made.
 */

const MAX_UPGRADE = 5;
// chance of success for reaching +1 … +5
const UPGRADE_CHANCE = [1, 0.9, 0.75, 0.6, 0.45];
// failing to reach this level or higher drops the item a level
const DROP_FROM = 3;
const UPGRADE_CATEGORIES = ['weapons', 'armor', 'miscellaneous'];
const MATERIAL_DROP_CHANCE = 0.25;
const MAX_SALVAGE_PER_COPY = 5;
// cheaper gear can't be salvaged: its materials would sell for more than it costs
const MIN_SALVAGE_PRICE = 100;

const CRAFTED = new Set(recipes.map((recipe) => recipe.item_ID));
const FOR_SALE = new Set(materials.forSale);

// Whether the shop sells this (global) item: not crafted items, and only the commonest materials.
const isForSale = (shopItem) => {
	if (CRAFTED.has(shopItem.item_ID)) return false;
	if (shopItem.category === 'materials') return FOR_SALE.has(shopItem.itemName);
	return true;
};

const tierFor = (level) => [...materials.tiers].reverse().find((tier) => level >= tier.minLevel) ?? materials.tiers[0];

// The material that upgrades (and salvages from) this item.
const materialFor = (shopItem) => {
	const tier = tierFor(shopItem.level);
	return shopItem.category === 'weapons' ? tier.metal : tier.hide;
};

// What reaching +level costs: { iura, material, amount }.
const upgradeCost = (shopItem, level) => ({
	iura: Math.max(Math.round(shopItem.price * 0.25 * level), 10),
	material: materialFor(shopItem),
	amount: 2 * level,
});

const recipeFor = (itemID) => recipes.find((recipe) => recipe.item_ID === itemID) ?? null;

// Takes `amount` of an item from the player's unequipped copies. False if they don't have enough.
const takeItem = async (accountID, itemName, amount, transaction) => {
	const item = await Item.findOne({ where: { accountID, itemName }, transaction, lock: transaction.LOCK.UPDATE });
	if (!item || item.quantity < amount) return false;
	const quantity = item.quantity - amount;
	// the last copy gone: its upgrade goes with it
	await item.update({ quantity, ...(quantity + item.equippedAmount === 0 ? { upgradeLevel: 0 } : {}) }, { transaction });
	return true;
};

const giveItem = async (accountID, itemName, amount, transaction) => {
	const item = await Item.findOne({ where: { accountID, itemName }, transaction, lock: transaction.LOCK.UPDATE });
	if (item) await item.update({ quantity: item.quantity + amount }, { transaction });
	else await Item.create({ accountID, itemName, quantity: amount }, { transaction });
};

const ownedCount = async (accountID, itemName, transaction) =>
	(await Item.findOne({ where: { accountID, itemName }, transaction }))?.quantity ?? 0;

const spend = async (accountID, amount, transaction) => {
	try {
		await moveIura(accountID, 'wallet', null, amount, transaction);
		return true;
	}
	catch (error) {
		if (error.message === 'insufficient funds' || error.message === 'account not found') return false;
		throw error;
	}
};

/**
 * Tries to upgrade the player's item one level. Returns
 * { ok: true, itemName, success, from, to, chance, cost, warded } or
 * { ok: false, reason } with reason 'not owned', 'not upgradable', 'max',
 * 'materials', 'iura' or 'no ward' (with what it needed as `cost`).
 */
const upgradeItem = (accountID, itemID, { ward = false, random = Math.random } = {}) => sequelize.transaction(async (transaction) => {
	const player = await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
	const shopItem = await Shop.findOne({ where: { item_ID: itemID, guildID: null }, transaction });
	const item = player && shopItem && await Item.findOne({
		where: { accountID, itemName: shopItem.itemName },
		transaction,
		lock: transaction.LOCK.UPDATE,
	});
	if (!item || item.quantity + item.equippedAmount < 1) return { ok: false, reason: 'not owned' };
	if (!UPGRADE_CATEGORIES.includes(shopItem.category)) return { ok: false, reason: 'not upgradable' };
	if (item.upgradeLevel >= MAX_UPGRADE) return { ok: false, reason: 'max' };

	const from = item.upgradeLevel;
	const to = from + 1;
	const cost = upgradeCost(shopItem, to);
	const wardUsed = ward && to >= DROP_FROM;
	if (wardUsed && await ownedCount(accountID, materials.ward, transaction) < 1) return { ok: false, reason: 'no ward', cost };
	if (await ownedCount(accountID, cost.material, transaction) < cost.amount) return { ok: false, reason: 'materials', cost };
	if (!await spend(accountID, cost.iura, transaction)) return { ok: false, reason: 'iura', cost };
	await takeItem(accountID, cost.material, cost.amount, transaction);
	if (wardUsed) await takeItem(accountID, materials.ward, 1, transaction);

	const chance = UPGRADE_CHANCE[from];
	const success = random() < chance;
	const level = success ? to : (to >= DROP_FROM && !wardUsed ? from - 1 : from);
	if (level !== from) {
		await item.update({ upgradeLevel: level }, { transaction });
		// equipped: the player's stats follow the item
		if (item.equippedAmount > 0) {
			const before = statsFor(shopItem, from);
			const after = statsFor(shopItem, level);
			await player.update({
				totalHealth: player.totalHealth + (after.totalHealth - before.totalHealth) * item.equippedAmount,
				totalAttack: player.totalAttack + (after.totalAttack - before.totalAttack) * item.equippedAmount,
				totalDefense: player.totalDefense + (after.totalDefense - before.totalDefense) * item.equippedAmount,
			}, { transaction });
		}
	}
	return { ok: true, itemName: shopItem.itemName, success, from, to: level, chance, cost, warded: wardUsed };
});

/**
 * Crafts `amount` of a recipe's item. Returns { ok: true, itemName, amount }
 * or { ok: false, reason } with reason 'amount', 'unknown', 'level',
 * 'materials' (with `missing`: [{ item, need, have }]) or 'iura'.
 */
const craftItem = (accountID, itemID, amount = 1) => {
	if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100) return Promise.resolve({ ok: false, reason: 'amount' });
	const recipe = recipeFor(itemID);
	if (!recipe) return Promise.resolve({ ok: false, reason: 'unknown' });

	return sequelize.transaction(async (transaction) => {
		const player = await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
		const shopItem = await Shop.findOne({ where: { item_ID: itemID, guildID: null }, transaction });
		if (!player || !shopItem) return { ok: false, reason: 'unknown' };
		if (player.level < recipe.level) return { ok: false, reason: 'level', level: recipe.level };

		const missing = [];
		for (const input of recipe.inputs) {
			const have = await ownedCount(accountID, input.item, transaction);
			if (have < input.amount * amount) missing.push({ item: input.item, need: input.amount * amount, have });
		}
		if (missing.length) return { ok: false, reason: 'materials', missing };
		if (!await spend(accountID, recipe.iura * amount, transaction)) return { ok: false, reason: 'iura', iura: recipe.iura * amount };

		for (const input of recipe.inputs) await takeItem(accountID, input.item, input.amount * amount, transaction);
		await giveItem(accountID, shopItem.itemName, amount, transaction);
		return { ok: true, itemName: shopItem.itemName, amount };
	});
};

// What salvaging one copy gives: [{ item, amount }]. `lastCopy` adds one per upgrade level.
const salvageYield = (shopItem, upgradeLevel = 0, lastCopy = false) => [
	{ item: materialFor(shopItem), amount: Math.min(1 + Math.floor(shopItem.price / 1000), MAX_SALVAGE_PER_COPY) + (lastCopy ? upgradeLevel : 0) },
	{ item: materials.dust, amount: 1 },
];

/**
 * Breaks `amount` unequipped copies of gear into materials. Returns
 * { ok: true, itemName, gained: [{ item, amount }] } or { ok: false, reason }
 * with reason 'amount', 'not found', 'not salvageable' or 'not enough'.
 */
const salvageItem = (accountID, itemID, amount = 1) => {
	if (!Number.isSafeInteger(amount) || amount < 1) return Promise.resolve({ ok: false, reason: 'amount' });

	return sequelize.transaction(async (transaction) => {
		await Player.findByPk(accountID, { transaction, lock: transaction.LOCK.UPDATE });
		const shopItem = await Shop.findOne({ where: { item_ID: itemID, guildID: null }, transaction });
		if (!shopItem) return { ok: false, reason: 'not found' };
		if (!UPGRADE_CATEGORIES.includes(shopItem.category) || shopItem.price < MIN_SALVAGE_PRICE) return { ok: false, reason: 'not salvageable' };
		const item = await Item.findOne({ where: { accountID, itemName: shopItem.itemName }, transaction, lock: transaction.LOCK.UPDATE });
		if (!item || item.quantity < amount) return { ok: false, reason: 'not enough' };

		const lastCopy = item.quantity - amount + item.equippedAmount === 0;
		const totals = new Map();
		for (let i = 0; i < amount; i++) {
			for (const { item: name, amount: n } of salvageYield(shopItem, item.upgradeLevel, lastCopy && i === amount - 1)) {
				totals.set(name, (totals.get(name) ?? 0) + n);
			}
		}
		await takeItem(accountID, shopItem.itemName, amount, transaction);
		for (const [name, n] of totals) await giveItem(accountID, name, n, transaction);
		return { ok: true, itemName: shopItem.itemName, gained: [...totals].map(([name, n]) => ({ item: name, amount: n })) };
	});
};

// One material of the tier for `level`: the metal or hide, or now and then Arcane Dust.
const pickMaterial = (level, random = Math.random) => {
	const roll = random();
	const tier = tierFor(level);
	if (roll < 0.45) return tier.metal;
	if (roll < 0.9) return tier.hide;
	return materials.dust;
};

/**
 * Rolls for a material after a win (MATERIAL_DROP_CHANCE), or gives `count`
 * with `guaranteed` (an /explore find). Returns { item, amount } or null.
 */
const rollMaterial = async (player, { level = player.level, count = 1, guaranteed = false, random = Math.random } = {}) => {
	if (!guaranteed && random() >= MATERIAL_DROP_CHANCE) return null;
	const item = pickMaterial(level, random);
	await player.addItem(item, count);
	return { item, amount: count };
};

module.exports = {
	MAX_UPGRADE,
	UPGRADE_CHANCE,
	DROP_FROM,
	MATERIAL_DROP_CHANCE,
	MIN_SALVAGE_PRICE,
	recipes,
	materials,
	isForSale,
	tierFor,
	materialFor,
	upgradeCost,
	recipeFor,
	upgradeItem,
	craftItem,
	salvageYield,
	salvageItem,
	rollMaterial,
};
