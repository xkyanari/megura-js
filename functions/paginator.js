const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');

async function buttonPages(interaction, pages, selectMenu = null, optionPages = null, time = 60000) {
    /**
     * if (!interaction) throw new Error("Please provide an interaction argument");
     * if (!pages) throw new Error("Please provide a page argument");
     * if (!Array.isArray(pages)) throw new Error("Pages must be an array");

     * if (typeof time !== "number") throw new Error("Time must be a number");
     * if (parseInt(time) < 30000) throw new Error("Time must be greater than 30 seconds");
     */

    if (pages.length === 1) {
        const page = await interaction.editReply({
            embeds:pages,
            components: [],
            fetchReply: true,
        });

        return page;
    }

    const prev = new ButtonBuilder()
        .setCustomId('prev')
        .setEmoji('◀️')
        .setStyle(ButtonStyle.Primary);
    
    const home = new ButtonBuilder()
        .setCustomId('home')
        .setEmoji('🏠')
        .setStyle(ButtonStyle.Primary);
    
    const next = new ButtonBuilder()
        .setCustomId('next')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary);

    const buttonRow = new ActionRowBuilder().addComponents(prev, home, next);
    
    let selectMenuRow;
    if (selectMenu) {
        selectMenuRow = new ActionRowBuilder().addComponents(selectMenu);
    }

    let index = 0;
    
    const currentPage = await interaction.editReply({
        embeds: [pages[index]],
        components: selectMenu ? [selectMenuRow, buttonRow] : [buttonRow],
        fetchReply: true
    });
    
    const collector = await currentPage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time
    });

    collector.on("collect", async (button) => {
        if (button.user.id !== interaction.user.id)
            return button.reply({
                content: "You cannot use these buttons",
                ephemeral: true
            });
        
        await button.deferUpdate();

        if (button.customId === "prev") {
            if (index > 0) index--;
        } else if (button.customId === "home") {
            index = 0;
        } else if (button.customId === "next") {
            if (index < pages.length - 1) index++;
        }

        if (index === 0) prev.setDisabled(true);
        else prev.setDisabled(false);

        if (index === 0) home.setDisabled(true);
        else home.setDisabled(false);

        if (index === pages.length - 1) next.setDisabled(true);
        else next.setDisabled(false);

        if (selectMenu && optionPages) {
            selectMenu = selectMenu.setOptions(optionPages[index]);
            selectMenuRow = new ActionRowBuilder().addComponents(selectMenu);
        }
        
        await currentPage.edit({
            embeds: [pages[index]],
            components: selectMenu ? [selectMenuRow, buttonRow] : [buttonRow]
        });
        
        collector.resetTimer();
    });

    collector.on("end", async (button) => {
        await currentPage.edit({
            embeds: [pages[index]],
            components: []
        });
    });

    return currentPage;
};

module.exports = buttonPages;