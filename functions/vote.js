const { Player } = require('../src/db');

const voteWebhook = async (id) => {
    try {
        const player = await Player.findOne({ where: { discordID: id }, include: 'iura' });
    
        player.iura.walletAmount += 50;
        await player.iura.save();
    } catch (error) {
        console.error(error);
    }
};

module.exports = { voteWebhook };