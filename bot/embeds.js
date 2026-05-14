const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require("discord.js");
const { SUPPORT_CATEGORIES } = require("../config");

function getSupportMenuEmbed() {
  return new EmbedBuilder()
    .setTitle("🛟 Destek Sistemi / Support System")
    .setDescription("Lütfen aşağıdan bir kategori seçin.\n\nPlease select a category below.")
    .setColor(0x7c6af7)
    .setFooter({ text: "Sentara Support • bemsentara.onrender.com" })
    .setImage("https://cdn.discordapp.com/attachments/1234567890/sentara-banner.png");
}

function getCategorySelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("support_category")
      .setPlaceholder("Kategori seçin / Select Category")
      .addOptions(
        { label: "💳 Ödeme Sorunu", value: "billing", emoji: "💳" },
        { label: "🔧 Teknik Sorun", value: "technical", emoji: "🔧" },
        { label: "👤 Hesap Sorunu", value: "account", emoji: "👤" },
        { label: "👥 Grup Sorunu", value: "group", emoji: "👥" },
        { label: "📝 Diğer", value: "other", emoji: "📝" }
      )
  );
}

function getSupportButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_support_menu")
      .setLabel("🎫 Destek Menüsünü Aç / Open Support Menu")
      .setStyle(ButtonStyle.Primary)
  );
}

function buildTicketEmbed(ticket) {
  const categoryInfo = SUPPORT_CATEGORIES[ticket.category] || SUPPORT_CATEGORIES.other;
  return new EmbedBuilder()
    .setTitle(`🎫 ${ticket.ticketId}`)
    .setColor(categoryInfo.color)
    .addFields(
      { name: "📋 Konu", value: ticket.subject, inline: false },
      { name: "📝 Açıklama", value: ticket.description, inline: false },
      { name: "🎯 Öncelik", value: ticket.priority.toUpperCase(), inline: true },
      { name: "👤 Açan", value: `<@${ticket.userId}>`, inline: true },
      { name: "⏰ Tarih", value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:f>`, inline: true }
    )
    .setFooter({ text: "Sentara Support" })
    .setTimestamp();
}

function buildCloseButton(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_ticket_${ticketId}`)
      .setLabel("🔒 Ticket'ı Kapat")
      .setStyle(ButtonStyle.Danger)
  );
}

module.exports = {
  getSupportMenuEmbed,
  getCategorySelectMenu,
  getSupportButton,
  buildTicketEmbed,
  buildCloseButton,
};
