const { Player } = require("../src/db");

const voteWebhook = async (id, votes = 1) => {
  try {
    const player = await Player.findOne({
      where: { discordID: id },
      include: "iura",
    });
    console.log(player);

    player.iura.walletAmount += 50 * votes;
    await player.iura.save();
  } catch (error) {
    console.error(error);
  }
};

module.exports = { voteWebhook };
