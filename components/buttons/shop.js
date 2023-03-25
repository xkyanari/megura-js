const shop = require('../../functions/shop');

module.exports = {
    data: {
        name: `shop`,
    },
    async execute(interaction) {
        await shop(interaction);
    }
};