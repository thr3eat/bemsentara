/**
 * TMT Support System Message Service
 * Posts support system menu to TMT server
 */

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { TMT_GUILD_ID, TMT_SUPPORT_CHANNEL_ID, TMT_SUPPORT_CATEGORIES } = require("../../config");

/**
 * Get TMT support menu embed
 */
function getTMTSupportMenuEmbed() {
  return new EmbedBuilder()
    .setTitle("🛟 Destek Sistemi / Support System")
    .setDescription("Lütfen aşağıdan bir kategori seçin.\n\nPlease select a category below.")
    .setColor(0xDC143C)
    .setFooter({ text: "TMT Support • Lütfen sorununuzu detaylı bir şekilde açıklayın" });
}

/**
 * Get TMT support category select menu
 */
function getTMTCategorySelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("tmt_support_category")
      .setPlaceholder("Kategori seçin / Select Category")
      .addOptions(
        {
          label: "📚 Discord Destek",
          value: "discord",
          description: "Discord sunucularımız ile ilgili sorunlar",
          emoji: "📚"
        },
        {
          label: "💂🏻 Oyun Destek",
          value: "game",
          description: "Oyunumuzda yaşanan sorunlar ve yardımlar",
          emoji: "💂🏻"
        }
      )
  );
}

/**
 * Post TMT support system message
 */
async function postTMTSupportMessage(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    const channel = await guild.channels.fetch(TMT_SUPPORT_CHANNEL_ID);

    const embed = getTMTSupportMenuEmbed();
    const menu = getTMTCategorySelectMenu();

    await channel.send({ embeds: [embed], components: [menu] });
    console.log("✅ TMT destek sistemi mesajı gönderildi");
    return true;
  } catch (error) {
    console.error("❌ TMT destek sistemi mesajı gönderilirken hata:", error);
    return false;
  }
}

/**
 * Ensure TMT support message exists
 */
async function ensureTMTSupportMessage(client) {
  try {
    const guild = await client.guilds.fetch(TMT_GUILD_ID);
    const channel = await guild.channels.fetch(TMT_SUPPORT_CHANNEL_ID);
    
    const messages = await channel.messages.fetch({ limit: 10 });
    const existingMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
    
    if (!existingMessage) {
      await postTMTSupportMessage(client);
    }
  } catch (error) {
    console.error("❌ TMT destek mesajı kontrol edilirken hata:", error);
  }
}

module.exports = {
  getTMTSupportMenuEmbed,
  getTMTCategorySelectMenu,
  postTMTSupportMessage,
  ensureTMTSupportMessage,
};
