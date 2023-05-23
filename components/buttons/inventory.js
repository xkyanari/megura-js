const inventory = require("../../functions/inventory");

module.exports = {
  data: {
    name: `inventory`,
  },
  async execute(interaction) {
    await inventory(interaction);
  },
};
