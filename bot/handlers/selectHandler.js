const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

function handleSelectInteraction(interaction) {
  if (interaction.customId !== "support_category") return null;

  const category = interaction.values[0];

  // Kategori bazlı başlık ve placeholder
  const categoryTitles = {
    ban:       'Ban / Şikayet Talebi',
    reklam:    'Reklam Satın Al',
    report:    'Kullanıcı Şikayet',
    billing:   'Ödeme Sorunu',
    technical: 'Teknik Sorun',
    account:   'Hesap Sorunu',
    genel:     'Genel Destek',
    other:     'Diğer Konu',
  };
  const categoryDescHints = {
    ban:       'Kimi şikayet ediyorsunuz? (kullanıcı adı/ID)',
    reklam:    'Reklamını yapmak istediğiniz konu nedir?',
    report:    'Hangi kullanıcıyı şikayet ediyorsunuz?',
    billing:   'Ödeme sorununuzu açıklayın',
    technical: 'Teknik sorununuzu açıklayın',
    account:   'Hesap sorununuzu açıklayın',
    genel:     'Sorunuzu veya talebinizi yazın',
    other:     'Konunuzu açıklayın',
  };

  const title = categoryTitles[category] || 'Destek Talebi';
  const descHint = categoryDescHints[category] || 'Sorununuzu açıklayın';

  const modal = new ModalBuilder()
    .setCustomId(`support_modal_${category}`)
    .setTitle(`🎫 ${title}`);

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_subject")
        .setLabel("Konu Başlığı")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Örn: ${title} hakkında`)
        .setRequired(true)
        .setMaxLength(100)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("support_description")
        .setLabel("Açıklama")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(descHint)
        .setRequired(true)
        .setMaxLength(1000)
    )
  );

  return interaction.showModal(modal);
}

module.exports = { handleSelectInteraction };
