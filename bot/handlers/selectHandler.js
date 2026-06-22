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

    const StaffUnit = require("../../models/StaffUnit");
    const userUnit = await StaffUnit.findOne({ userId: interaction.user.id });
    if (userUnit && userUnit.unitName) {
      let allowed = false;
      if (userUnit.unitName === 'BAN_BIRIMI' && (selectedTask === 'task_ticket' || selectedTask === 'task_mod')) allowed = true;
      if (userUnit.unitName === 'SES_BIRIMI' && selectedTask === 'task_voice') allowed = true;
      if (userUnit.unitName === 'SOHBET_BIRIMI' && selectedTask === 'task_chat') allowed = true;
      if (!allowed) {
        return interaction.reply({ content: '❌ Bulunduğunuz birim dışındaki bir görevi seçemezsiniz!', ephemeral: true });
      }
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

  if (interaction.customId !== "support_category" && interaction.customId !== "tmt_support_category" && interaction.customId !== "ekoyildiz_support_category") return null;

  const category = interaction.values[0];
  const isTMT = interaction.customId === "tmt_support_category";
  const isEko = interaction.customId === "ekoyildiz_support_category";

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
    // TMT Categories
    discord:   'Discord Destek',
    game:      'Oyun Destek',
    // EkoYildiz Categories
    kullanici_destek: 'Kullanıcı Destek',
    reklam_destek:    'Reklam Destek',
    diger_destek:     'Diğer Destek',
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
    // EkoYildiz Categories
    kullanici_destek: 'Kimi ve neden şikayet ediyorsunuz?',
    reklam_destek:    'Reklam talebinizi açıklayın',
    diger_destek:     'Talebinizi açıklayın',
  };

  const title = categoryTitles[category] || 'Destek Talebi';
  const descHint = categoryDescHints[category] || 'Sorununuzu açıklayın';

  let modalCustomId = `support_modal_${category}`;
  if (isTMT) modalCustomId = `tmt_support_modal_${category}`;
  else if (isEko) modalCustomId = `ekoyildiz_support_modal_${category}`;

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
