module.exports = {
    data: {
        name: `sample`,
    },
    async execute(interaction) {
        await interaction.reply({ content: "You got it!" });
    }
};