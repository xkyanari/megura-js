const { executeBid } = require("../../functions/executeBid");

module.exports = {
    data: {
        name: 'placeBid3',
    },
    async execute(interaction) {
        await executeBid(interaction, 1644715);
    },
};
