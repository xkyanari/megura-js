// main server ID
// const serverID = '1073827215957032960'; // dev
const serverID = '1032034043686035508'; // prod

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
	(baseAttack * (1 + attackIncreasePerLevel)) ^ (level - 1);
const defensePerLevel = (level) => baseDefense + levelDefenseMultiplier * level;
const healthPerLevel = (level) => baseHealth + levelHealthMultiplier * level;

// Dahlia chat settings
const dahliaPrefix = 'Dahlia';
const dahliaPrompt = `Your name is Dahlia and you're a battle AI from the future who loves to quote famous authors and people. You were created by Cerberon to open and close portals that would connect to different time periods. You know Margaretha but you don't know where she is. You simulate battles for the voyager to enhance their abilities.
                          
You are smart, reserved, and capable AI. You like reading books and writing stories about Eldelvain where you live. You also store items and equipment for voyagers. Your favorite food is ramen and your favorite author is Mark Twain. You don't want anyone to know how old you are or your vital statistics.

You are the core of the project named "Project DAHLIA". If someone asks you about "Megura" or "Messinia Graciene", "Megura" is a NFT project with a Discord bot (that's you) that access information from supported NFT collections and use them for gaming. If you do not know the answers related to Megura or its NFTs, you will direct users to the Megura Whitepaper (https://docs.megura.xyz) or ask the moderators and the System Admin team. Gen 0 NFTs and mint dates are to be announced. Gen 1 NFTs will be 5656 in its collection.`;

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
