const { Player } = require('../src/db');

const voteWebhook = async (id) => {
    try {
        const player = await Player.findOne({ where: { discordID: id }, include: 'iura '});
    
        player.iura.walletAmount += 200;
        return await player.save();
    } catch (error) {
        console.error(error);
    }
};

module.exports = { voteWebhook };