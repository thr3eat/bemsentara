const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { SUPPORT_CATEGORIES } = require("../config");

function getSupportMenuEmbed() {
  return new EmbedBuilder()
    .setTitle("🛟 Destek Sistemi / Support System")
    .setDescription("Lütfen aşağıdan bir kategori seçin.\n\nPlease select a category below.")
    .setColor(0x7c6af7)
    .setFooter({ text: "Sentara Support • Eko tarafından tasarlandı" })
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

/** Ticket kapatma sebebi soran modal */
function buildCloseReasonModal(ticketId) {
  const modal = new ModalBuilder()
    .setCustomId(`close_reason_modal_${ticketId}`)
    .setTitle("Ticket Kapatma Sebebi");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("close_reason")
        .setLabel("Kapatma Sebebi")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Bu ticket'ı neden kapatıyorsunuz?")
        .setRequired(true)
        .setMaxLength(500)
    )
  );

  return modal;
}

/** Kullanıcıya DM'de gönderilecek "Tekrar Aç" ve "Değerlendir" butonları */
function buildReopenAndRateRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reopen_ticket_${ticketId}`)
      .setLabel("🔓 Tekrar Aç")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rate_ticket_${ticketId}`)
      .setLabel("⭐ Değerlendir")
      .setStyle(ButtonStyle.Primary)
  );
}

/** Değerlendirme modal'ı (5 yıldız + yorum) */
function buildRatingModal(ticketId) {
  const modal = new ModalBuilder()
    .setCustomId(`rating_modal_${ticketId}`)
    .setTitle("Destek Değerlendirmesi");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rating_score")
        .setLabel("Puan (1-5)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("1, 2, 3, 4 veya 5 girin")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("rating_note")
        .setLabel("Değerlendirme Notu (isteğe bağlı)")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Destek hakkında düşüncelerinizi yazın...")
        .setRequired(false)
        .setMaxLength(500)
    )
  );

  return modal;
}

module.exports = {
  getSupportMenuEmbed,
  getCategorySelectMenu,
  getSupportButton,
  buildTicketEmbed,
  buildCloseButton,
  buildCloseReasonModal,
  buildReopenAndRateRow,
  buildRatingModal,
};
