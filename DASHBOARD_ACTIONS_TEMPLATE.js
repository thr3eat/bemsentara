/**
 * MODERATÖR DASHBOARD - İŞLEM HANDLER ŞABLONU
 * 
 * Bu dosya, dashboard işlemlerinin nasıl uygulanacağını gösteren
 * örnek implementasyonlardır. Her kategorinin handler'larını içerir.
 * 
 * Kullanım: Bu şablonu kendi implementation'larınız için referans olarak kullanın.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');

// ═══════════════════════════════════════════════════════════════════════════════
// 👥 PERSONEL YÖNETİMİ - İŞLEM HANDLER'LARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * İşlem: Personel Ada Göre Ara
 * customId: mod_action_search_by_name
 */
async function handleSearchPersonnelByName(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Modal göster
    const modal = new ModalBuilder()
      .setCustomId('personnel_search_name_modal')
      .setTitle('👤 Personel Ada Göre Ara');

    const nameInput = new TextInputBuilder()
      .setCustomId('personnel_name')
      .setLabel('Personel Adı')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: Ahmet Yılmaz')
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder().addComponents(nameInput));

    await interaction.showModal(modal);

  } catch (err) {
    console.error('[searchPersonnelByName]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

/**
 * Modal Handler: Personel Ada Göre Ara
 * customId: personnel_search_name_modal
 */
async function handleSearchPersonnelByNameModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const name = interaction.fields.getTextInputValue('personnel_name');

    // Veritabanında ara (örnek)
    // const results = await PersonnelModel.find({ 
    //   name: { $regex: name, $options: 'i' } 
    // }).limit(10);

    // Dummy sonuçlar
    const results = [
      { id: '1', name: 'Ahmet Yılmaz', level: 3, status: 'active' },
      { id: '2', name: 'Mehmet Kaya', level: 2, status: 'active' },
    ];

    if (results.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Sonuç Bulunamadı')
        .setDescription(`"${name}" adı ile personel bulunamadı.`);

      return interaction.editReply({ embeds: [embed] });
    }

    // Sonuçları göster
    const embed = new EmbedBuilder()
      .setTitle('🔍 Arama Sonuçları')
      .setDescription(`"${name}" ile ${results.length} sonuç bulundu.`)
      .setColor(0x3498db)
      .addFields(
        results.map(p => ({
          name: `👤 ${p.name}`,
          value: `ID: \`${p.id}\` | Level: ${p.level} | Status: ${p.status}`,
          inline: false
        }))
      )
      .setTimestamp();

    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('personnel_select_for_action')
        .setPlaceholder('Personeli seçin')
        .addOptions(
          results.map(p => ({
            label: p.name,
            value: p.id,
            description: `Level ${p.level} • ${p.status}`
          }))
        )
    );

    return interaction.editReply({
      embeds: [embed],
      components: [selectRow]
    });

  } catch (err) {
    console.error('[searchPersonnelByNameModal]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

/**
 * İşlem: Rol Atama
 * customId: mod_action_role_assign
 */
async function handleRoleAssignment(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Personel seçimi
    const modal = new ModalBuilder()
      .setCustomId('role_assign_modal')
      .setTitle('👑 Rol Atama');

    const userIdInput = new TextInputBuilder()
      .setCustomId('user_id')
      .setLabel('Personel Discord ID\'si')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 123456789')
      .setRequired(true);

    const roleInput = new TextInputBuilder()
      .setCustomId('role_name')
      .setLabel('Atanacak Rol')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: Sekreter, Personel')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(roleInput)
    );

    await interaction.showModal(modal);

  } catch (err) {
    console.error('[handleRoleAssignment]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ DİSİPLİN - İŞLEM HANDLER'LARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * İşlem: Uyarı Ver
 * customId: mod_action_warn_issue
 */
async function handleIssueWarning(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Yetki kontrolü
    if (!interaction.member.permissions.has('MODERATE_MEMBERS')) {
      return interaction.editReply({
        content: '❌ Bu işlem için yönetici yetkisi gereklidir.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('issue_warning_modal')
      .setTitle('⚠️ Uyarı Ver');

    const userIdInput = new TextInputBuilder()
      .setCustomId('warned_user_id')
      .setLabel('Uyarılanacak Personel ID\'si')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const reasonInput = new TextInputBuilder()
      .setCustomId('warning_reason')
      .setLabel('Uyarı Sebebi')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Uyarı nedenini açıklayın')
      .setRequired(true)
      .setMaxLength(500);

    const severityInput = new TextInputBuilder()
      .setCustomId('warning_severity')
      .setLabel('Ciddiyet Derecesi (1-5)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('1 = Hafif, 5 = Çok Ciddi')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(severityInput)
    );

    await interaction.showModal(modal);

  } catch (err) {
    console.error('[handleIssueWarning]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

/**
 * Modal Handler: Uyarı Ver
 * customId: issue_warning_modal
 */
async function handleIssueWarningModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.fields.getTextInputValue('warned_user_id');
    const reason = interaction.fields.getTextInputValue('warning_reason');
    const severity = parseInt(interaction.fields.getTextInputValue('warning_severity')) || 1;

    // Validasyon
    if (severity < 1 || severity > 5) {
      return interaction.editReply({
        content: '❌ Ciddiyet derecesi 1-5 arasında olmalıdır.',
        ephemeral: true
      });
    }

    // Veritabanında kaydet (örnek)
    // const warning = new Warning({
    //   userId,
    //   reason,
    //   severity,
    //   issuedBy: interaction.user.id,
    //   issuedAt: new Date(),
    //   guildId: interaction.guildId
    // });
    // await warning.save();

    // Audit log'a kaydet
    const { centralAuditLog } = require('../services/centralAuditLog');
    await centralAuditLog(
      interaction.user.id,
      'ISSUE_WARNING',
      `Kullanıcı ${userId} için uyarı verildi: ${reason}`,
      interaction.guildId
    );

    // Başarı mesajı
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Uyarı Verildi')
      .setDescription(`<@${userId}> adlı personele uyarı verildi.`)
      .addFields(
        { name: '📝 Sebebi', value: reason, inline: false },
        { name: '🎯 Ciddiyet', value: `${'⭐'.repeat(severity)} (${severity}/5)`, inline: true },
        { name: '👤 Veren', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setTimestamp();

    // Personele DM gönder
    try {
      const user = await interaction.client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('⚠️ Resmi Uyarı')
        .setDescription(`Sisteminizin yöneticilerinden resmi bir uyarı aldınız.`)
        .addFields(
          { name: 'Sebebi', value: reason, inline: false },
          { name: 'Veren', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: 'Eko Yıldız • Disiplin Sistemi' })
        .setTimestamp();

      await user.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (_) {}

    return interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[handleIssueWarningModal]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 İK - İŞLEM HANDLER'LARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * İşlem: Maaş Hesapla
 * customId: mod_action_salary_calculate
 */
async function handleCalculateSalary(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const modal = new ModalBuilder()
      .setCustomId('calculate_salary_modal')
      .setTitle('🧮 Maaş Hesapla');

    const userIdInput = new TextInputBuilder()
      .setCustomId('salary_user_id')
      .setLabel('Personel Discord ID\'si')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const baseSalaryInput = new TextInputBuilder()
      .setCustomId('base_salary')
      .setLabel('Temel Maaş (TL)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 5000')
      .setRequired(true);

    const bonusInput = new TextInputBuilder()
      .setCustomId('bonus_percent')
      .setLabel('Bonus % (isteğe bağlı)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Örn: 10')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(baseSalaryInput),
      new ActionRowBuilder().addComponents(bonusInput)
    );

    await interaction.showModal(modal);

  } catch (err) {
    console.error('[handleCalculateSalary]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

/**
 * Modal Handler: Maaş Hesapla
 * customId: calculate_salary_modal
 */
async function handleCalculateSalaryModal(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.fields.getTextInputValue('salary_user_id');
    const baseSalary = parseFloat(interaction.fields.getTextInputValue('base_salary'));
    const bonusPercent = parseFloat(interaction.fields.getTextInputValue('bonus_percent')) || 0;

    // Validasyon
    if (isNaN(baseSalary) || baseSalary <= 0) {
      return interaction.editReply({
        content: '❌ Geçerli bir maaş değeri girin.',
        ephemeral: true
      });
    }

    // Hesapla
    const bonus = baseSalary * (bonusPercent / 100);
    const tax = baseSalary * 0.15; // Vergi %15
    const totalSalary = baseSalary + bonus - tax;

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('💰 Maaş Hesaplaması')
      .addFields(
        { name: '📊 Temel Maaş', value: `${baseSalary.toLocaleString('tr-TR')} TL`, inline: true },
        { name: '🎁 Bonus (%' + bonusPercent + ')', value: `${bonus.toLocaleString('tr-TR')} TL`, inline: true },
        { name: '🏛️ Vergi (%15)', value: `-${tax.toLocaleString('tr-TR')} TL`, inline: true },
        { name: '\u200B', value: '\u200B', inline: false },
        { name: '💳 Net Maaş', value: `${totalSalary.toLocaleString('tr-TR')} TL`, inline: false }
      )
      .setFooter({ text: 'Eko Yıldız • İK Sistemi' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[handleCalculateSalaryModal]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 RAPORLAMA - İŞLEM HANDLER'LARI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * İşlem: İstatistikler
 * customId: mod_action_stats_personnel
 */
async function handlePersonnelStatistics(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Veritabanından istatistikler al (örnek)
    const stats = {
      totalPersonnel: 45,
      activePersonnel: 38,
      onLeave: 5,
      suspended: 2,
      averagePerformance: 7.8,
      highestPerformers: [
        { name: 'Ahmet Yılmaz', score: 9.5 },
        { name: 'Fatma Çetin', score: 9.2 }
      ]
    };

    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle('📊 Personel İstatistikleri')
      .addFields(
        { name: '👥 Toplam Personel', value: `${stats.totalPersonnel}`, inline: true },
        { name: '🟢 Aktif Personel', value: `${stats.activePersonnel}`, inline: true },
        { name: '📅 İzinli', value: `${stats.onLeave}`, inline: true },
        { name: '🚫 Askıya Alınanlar', value: `${stats.suspended}`, inline: true },
        { name: '⭐ Ortalama Performans', value: `${stats.averagePerformance}/10`, inline: true },
        { name: '\u200B', value: '\u200B', inline: false },
        {
          name: '🏆 En İyi Performans Gösterenler',
          value: stats.highestPerformers.map(p => `**${p.name}** - ${p.score}/10`).join('\n'),
          inline: false
        }
      )
      .setFooter({ text: 'Eko Yıldız • Raporlama' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });

  } catch (err) {
    console.error('[handlePersonnelStatistics]', err);
    return interaction.editReply({
      content: `❌ Hata: ${err.message}`,
      ephemeral: true
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Personel Yönetimi
  handleSearchPersonnelByName,
  handleSearchPersonnelByNameModal,
  handleRoleAssignment,

  // Disiplin
  handleIssueWarning,
  handleIssueWarningModal,

  // İK
  handleCalculateSalary,
  handleCalculateSalaryModal,

  // Raporlama
  handlePersonnelStatistics
};

/**
 * KULLANIM TALIMATLARI:
 * 
 * 1. Bu fonksiyonları buttonHandler.js'e entegre edin:
 * 
 *    const dashboardActions = require('./dashboardActionsTemplate');
 *    
 *    if (customId === 'mod_action_search_by_name') {
 *      return dashboardActions.handleSearchPersonnelByName(interaction);
 *    }
 * 
 * 2. Modal handler'larını modalHandler.js'e ekleyin:
 * 
 *    if (customId === 'personnel_search_name_modal') {
 *      return dashboardActions.handleSearchPersonnelByNameModal(interaction);
 *    }
 * 
 * 3. Veritabanı işlemlerini kendi model'lerinizle değiştirin
 * 
 * 4. Error handling ve validation'ı gerekirse özelleştirin
 */
