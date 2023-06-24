const { executeBid } = require("../../functions/executeBid");

module.exports = {
    data: {
        name: 'placeBid1',
    },
    async execute(interaction) {
        await executeBid(interaction, 160000);
    },
};
