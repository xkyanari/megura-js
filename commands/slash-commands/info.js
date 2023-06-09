const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const logger = require('../../src/logger');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('List of Commands'),
	cooldown: 3000,
	async execute(interaction) {
		logger.log({
			level: 'info',
			message: `User: ${interaction.member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		const embed = new EmbedBuilder()
			.setTitle('🛡️ **COMMANDS:** 🛡️')
			.setImage(
				'https://res.cloudinary.com/dnjaazvr7/image/upload/v1684522493/megura/dahlia-twitter_yae5go.png',
			)
			.setDescription(
				`> **_/info_** - Shows this message.
                
                **Profile**
                > **_/start_** - Initiate creating own character.
                > **_/profile <username>_** -  Show profile of a user (blank for self).
                > **_/changenick_** -  Updates player name.
                > **_/join_** -  Adds your NFT to your player profile.
                
                **Quests**
                > **_/daily_** - Do a random quest to increase/decrease stats or gain Iura.
                
                **Battle**
                > **_/attack_** - Initiate attack against a random monster.
                > **_/duel_** - Initiate a duel against another player.
                
                **Basics**
                > **_/open <name of channel>_** - Creates a private channel, auto-closes in 10 minutes.
                > **_/close_**  - Closes a portal pre-maturely.
                > **_/iura_**  - Check your wallet or bank.
                > **_/shop_**  - Opens the Item Shop.
                > **_/inventory_**  - Opens your inventory.
                > **_/buy_** - Lets player to buy items in bulk.
                
                **Messinia Graciene: Project DAHLIA**
                [Invite Me](https://discord.com/api/oauth2/authorize?client_id=1108464420465692795&permissions=139855260823&scope=bot)🔸[Docs](https://docs.megura.xyz)🔸[Support Server](https://discord.gg/X9eEW6yuhq)🔸[Vote for Us!](https://discordbotlist.com/bots/dahlia/upvote)`,
			);

		await interaction.reply({ embeds: [embed] });
	},
};
