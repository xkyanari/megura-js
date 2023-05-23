const levelcheck = require("../../functions/levelcheck");

module.exports = {
  name: "level",
  description: "Check your level",
  usage: "",
  async execute(message) {
    await levelcheck(message);
  },
};
