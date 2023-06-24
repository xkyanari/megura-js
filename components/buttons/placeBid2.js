const { executeBid } = require("../../functions/executeBid");

module.exports = {
    data: {
        name: 'placeBid2',
    },
    async execute(interaction) {
        await executeBid(interaction, 250000);
    },
};
