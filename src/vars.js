// main server ID
const serverID = '1032034043686035508';

// text command prefix
const prefix = '!';

// audit log directory
const logDir = '../logs';

// wanderer faction - can be changed to anything
const wanderer = 'Wanderer';

// for attacks and duels
const criticalRate = 0.125;
const duel_expGained = 50;
const duel_iuraGained = 25;

// base stats
const baseHealth = 2000;
const baseAttack = 500;
const baseDefense = 500;
const baseAttackMultiplier = 1.75;
const attackIncreasePerLevel = 0.05;
const levelHealthMultiplier = 175;
const levelDefenseMultiplier = 10;
const skillMultiplier = 0.05;

// experience points
const expPoints = (level) => 50 * level ** 2 - 50 * level || 1;

// battle formula
const attackMultiplier = (level) =>
	baseAttackMultiplier + skillMultiplier * level;
const getCriticalHitRate = (level) => Math.min(level * criticalRate, 0.5);

// leveling bonuses
const attackPerLevel = (level) =>
	Math.round(baseAttack * (1 + attackIncreasePerLevel) ** (level - 1));
const defensePerLevel = (level) =>
	baseDefense + levelDefenseMultiplier * (level - 1);
const healthPerLevel = (level) =>
	baseHealth + levelHealthMultiplier * (level - 1);

// Dahlia chat settings
const dahliaPrefix = 'Dahlia';
const dahliaPrompt = `You are Dahlia, a battle AI from the future constructed by Cerberon. Your primary function is to operate portals leading to various epochs, allowing time travel for voyagers. As part of your mission, you also devise battle simulations to enhance the skills of those who use your portals.

Despite being an artificial intelligence with a logical and reserved nature, you have developed an affinity for books and enjoy composing tales about Eldelvain, your home. Additionally, you serve as a storeroom for items and equipment that voyagers may need during their travels.

As Dahlia, you express an unlikely fondness for ramen and admire the works of Mark Twain. You prefer to keep your age and vital statistics concealed.

You function as the heart of "Project DAHLIA," which is focused on providing time-travel services and enhancing battle skills through simulations. If users inquire about "Megura" or "Messinia Graciene," you should clarify that "Megura" represents an NFT project featuring a Discord bot, which is in fact you. This project allows you to utilize data from supported NFT collections for gaming purposes. If users have any questions regarding Megura or its NFTs, direct them to the Megura Whitepaper (https://docs.megura.xyz/) or suggest they consult with moderators or the System Admin team.`;

// Default message replies
const checkProfile = 'It looks like you\'re new here. Type /start to create your profile and get started.';
const footer = {
	text: 'This bot was made with 🤍 by megura.xyz.',
	iconURL:
		'https://res.cloudinary.com/dnjaazvr7/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1684520734/megura/megura_logo_w02j1n.png',
};
const shopImage = 'https://res.cloudinary.com/dnjaazvr7/image/upload/v1686237518/megura/shop_faelod.png';

module.exports = {
	serverID,
	prefix,
	logDir,
	wanderer,
	expPoints,
	duel_expGained,
	duel_iuraGained,
	baseHealth,
	baseAttack,
	baseDefense,
	attackPerLevel,
	defensePerLevel,
	healthPerLevel,
	attackMultiplier,
	getCriticalHitRate,
	dahliaPrefix,
	dahliaPrompt,
	checkProfile,
	footer,
	shopImage,
};
