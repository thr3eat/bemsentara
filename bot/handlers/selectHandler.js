const {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

async function handleSelectInteraction(interaction) {
  if (interaction.customId === "select_daily_task") {
    const selectedTask = interaction.values[0];
    const StaffProgress = require("../../models/StaffProgress");
    const { CHOSEN_TASKS, checkChosenTaskCompletion } = require("../services/staffSystem");

    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p || p.status !== 'active') {
      return interaction.reply({ content: '❌ Aktif personel kaydınız bulunamadı.', ephemeral: true });
    }

    if (p.daily.chosenTaskCompleted) {
      return interaction.reply({ content: '❌ Bugünün seçimli görevini zaten tamamladınız! Yeni görev seçemezsiniz.', ephemeral: true });
    }

    p.daily.chosenTask = selectedTask;
    await p.save();

    const taskText = CHOSEN_TASKS[selectedTask] || selectedTask;
    await interaction.reply({
      content: `🎯 Bugünün seçimli görevi başarıyla **"${taskText}"** olarak güncellendi!`,
      ephemeral: true
    });

    const client = interaction.client;
    await checkChosenTaskCompletion(p, client).catch(() => {});
    return;
  }

  if (interaction.customId !== "support_category" && interaction.customId !== "tmt_support_category") return null;

  const category = interaction.values[0];
  const isTMT = interaction.customId === "tmt_support_category";

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
    // TMT Categories
    discord:   'Discord ile ilgili sorununuzu açıklayın',
    game:      'Oyun içindeki sorununuzu açıklayın',
  };

  const title = categoryTitles[category] || 'Destek Talebi';
  const descHint = categoryDescHints[category] || 'Sorununuzu açıklayın';

  const modalCustomId = isTMT ? `tmt_support_modal_${category}` : `support_modal_${category}`;

  const modal = new ModalBuilder()
    .setCustomId(modalCustomId)
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
