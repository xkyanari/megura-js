// Testnet behaviour: brawls run normally but no ores move.
require('./config').isTestnet = true;

require('./brawl-wager')(0);
