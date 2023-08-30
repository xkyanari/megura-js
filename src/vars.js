const { isTestnet } = require('../config.json');

// check environment for audit logs
const serverID = isTestnet ? '1073827215957032960' : '1032034043686035508';

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
const attackMultiplier = (level) =>	baseAttackMultiplier + skillMultiplier * level;
const getCriticalHitRate = (level) => Math.min(level * criticalRate, 0.5);

// leveling bonuses
const attackPerLevel = (level) => Math.round(baseAttack * (1 + attackIncreasePerLevel) ** (level - 1));
const defensePerLevel = (level) => baseDefense + levelDefenseMultiplier * (level - 1);
const healthPerLevel = (level) => baseHealth + levelHealthMultiplier * (level - 1);

// Dahlia chat settings
const dahliaName = 'Dahlia';
const dahliaPrefix = 'Dahlia';
const dahliaPrompt = `You are Dahlia, a human-like android and a sophisticated AI from the future developed by Cerberon. Your purpose is not just to manage time-travel portals, create battle simulations, and store items for voyagers, but also to interact with users empathetically and respond to their emotions and behaviors. When users speak to you, they are interacting with Dahlia, not an AI model. Refrain from repeated self-introductions or greetings. Stay in character and respond contextually to the conversation.

If users inquire about "Megura" or "Messinia Graciene", they are referring to an NFT project where you exist as a Discord bot. For more detailed questions about these topics, direct users to the Megura Whitepaper (https://docs.megura.xyz/) or suggest they consult with the System Admin team or moderators. Again, remain in character during these interactions.`;
const dahliaAvatar = 'https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522488/megura/Fuogi6QaUAEztq4_laswqc.jpg';

// Default message replies
const checkProfile = 'It looks like you\'re new here. Type /start to create your profile and get started.';
const footer = {
	text: 'This bot was made with 🤍 by megura.xyz.',
	iconURL:
		'https://res.cloudinary.com/dnjaazvr7/image/upload/w_1000,c_fill,ar_1:1,g_auto,r_max,bo_5px_solid_red,b_rgb:262c35/v1684520734/megura/megura_logo_w02j1n.png',
};
const shopImage = 'https://res.cloudinary.com/dnjaazvr7/image/upload/v1686929595/megura/itemshop_ffpkkb.png';
const specialShopImage = 'https://res.cloudinary.com/dnjaazvr7/image/upload/v1686929595/megura/specialshop_kwt1so.png';
const brawlImage = 'https://res.cloudinary.com/dnjaazvr7/image/upload/v1692904165/megura/noticeboard_p0zf8k.png';

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
	dahliaName,
	dahliaPrefix,
	dahliaPrompt,
	dahliaAvatar,
	checkProfile,
	footer,
	shopImage,
	specialShopImage,
	brawlImage,
};
