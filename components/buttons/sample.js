module.exports = {
    data: {
        name: `sample-button`,
    },
    async execute(interaction) {
        await interaction.reply({ content: "You got it!" });
    }
};