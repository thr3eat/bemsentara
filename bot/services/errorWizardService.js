'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { chatWithAI } = require("./aiService");

const EKONQTX_ID = "1031620522406072350";

// Active wizard sessions: `${userId}` → { errorDescription, context, aiAnalysis, ... }
const activeWizardSessions = new Map();

const ERROR_WIZARD_SYSTEM_PROMPT = `Sen Sentara botunun "Hata Sihirbazı" yapay zeka asistanısın.
Görevin: Personellerin bildirdiği hataları analiz etmek ve geliştiriciye (ekonqtx) detaylı, düzenli bir rapor sunmak.

Kurallar:
- Türkçe yaz, profesyonel ve teknik ol.
- Hata raporunu aşağıdaki formatta oluştur:
  📋 **HATA ÖZETİ:** (Kısa 1 cümle)
  🔍 **ANALİZ:** (Hatanın olası nedenleri, 2-3 madde)
  ⚡ **ÖNCELİK:** (Düşük / Orta / Yüksek / Kritik)
  🛠️ **ÖNERİLEN ÇÖZÜM:** (Kısa çözüm önerileri, 2-3 madde)
  📍 **ETKİLENEN SİSTEM:** (Hangi sistem/komut/modül etkileniyor)
- Eğer hata açıklaması yetersizse, genel bir analiz yap ve bunu belirt.
- Maksimum 500 karakter.`;

/**
 * Show the error wizard modal to a staff member
 */
function showErrorWizardModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("error_wizard_modal")
    .setTitle("🧙 Hata Sihirbazı");

  const errorDescRow = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId("error_desc")
      .setLabel("Hatayı detaylıca açıklayın")
      .setPlaceholder("Ne oldu? Hangi komut/özellikte sorun var? Hata mesajı neydi?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000)
  );

  const contextRow = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId("error_context")
      .setLabel("Hangi komut/sistem? (opsiyonel)")
      .setPlaceholder("Örn: /verify, ticket sistemi, rol sync, panel...")
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100)
  );

  const stepsRow = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId("error_steps")
      .setLabel("Hatayı nasıl tetiklediniz? (opsiyonel)")
      .setPlaceholder("Adımları yazın: 1. Şunu yaptım 2. Şu oldu...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500)
  );

  modal.addComponents(errorDescRow, contextRow, stepsRow);
  return interaction.showModal(modal);
}

/**
 * Handle the submitted error wizard modal
 */
async function handleErrorWizardSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const errorDesc = interaction.fields.getTextInputValue("error_desc");
  const errorContext = interaction.fields.getTextInputValue("error_context") || "Belirtilmedi";
  const errorSteps = interaction.fields.getTextInputValue("error_steps") || "Belirtilmedi";

  const reporter = interaction.user;
  const guild = interaction.guild;

  // 1. AI Analysis
  let aiAnalysis = "AI analizi yapılamadı.";
  try {
    const aiPrompt = `Bir personel aşağıdaki hatayı bildirdi:

**Hata Açıklaması:** ${errorDesc}
**Sistem/Komut:** ${errorContext}
**Tetikleme Adımları:** ${errorSteps}
**Sunucu:** ${guild?.name || "DM"}
**Bildiren:** ${reporter.tag}

Lütfen bu hatayı analiz et ve rapor formatında sun.`;

    aiAnalysis = await chatWithAI(aiPrompt, ERROR_WIZARD_SYSTEM_PROMPT, 'ticket', { max_tokens: 600 });
  } catch (err) {
    console.error("[ErrorWizard] AI analiz hatası:", err.message);
    aiAnalysis = `📋 **HATA ÖZETİ:** ${errorDesc.substring(0, 100)}\n🔍 **ANALİZ:** AI analizi başarısız oldu, manuel inceleme gerekli.\n⚡ **ÖNCELİK:** Belirlenemedi\n🛠️ **ÖNERİLEN ÇÖZÜM:** Geliştiricinin manuel incelemesi gerekiyor.\n📍 **ETKİLENEN SİSTEM:** ${errorContext}`;
  }

  // 2. Save session
  const sessionId = `wiz_${Date.now()}_${reporter.id.slice(-4)}`;
  activeWizardSessions.set(sessionId, {
    reporterId: reporter.id,
    reporterTag: reporter.tag,
    guildId: guild?.id,
    guildName: guild?.name || "DM",
    errorDesc,
    errorContext,
    errorSteps,
    aiAnalysis,
    timestamp: new Date(),
    status: "pending" // pending, acknowledged, resolved
  });

  // Clean up old sessions (keep last 50)
  if (activeWizardSessions.size > 50) {
    const keys = [...activeWizardSessions.keys()];
    for (let i = 0; i < keys.length - 50; i++) {
      activeWizardSessions.delete(keys[i]);
    }
  }

  // 3. Send DM to ekonqtx
  try {
    const devUser = await interaction.client.users.fetch(EKONQTX_ID).catch(() => null);
    if (devUser) {
      const dmEmbed = new EmbedBuilder()
        .setTitle("🧙 HATA SİHİRBAZI — Yeni Rapor")
        .setColor(0xE74C3C)
        .setDescription(aiAnalysis)
        .addFields(
          { name: "📝 Ham Açıklama", value: errorDesc.substring(0, 1024), inline: false },
          { name: "⚙️ Sistem/Komut", value: errorContext, inline: true },
          { name: "🏠 Sunucu", value: guild?.name || "DM", inline: true },
          { name: "👤 Bildiren", value: `${reporter.tag}\n\`${reporter.id}\``, inline: true },
          { name: "🔄 Tetikleme Adımları", value: (errorSteps || "Belirtilmedi").substring(0, 1024), inline: false }
        )
        .setThumbnail(reporter.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
        .setFooter({ text: `Rapor ID: ${sessionId}` });

      const dmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`wizard_ack_${sessionId}`)
          .setLabel("✅ Onaylandı")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`wizard_resolve_${sessionId}`)
          .setLabel("🔧 Çözüldü")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`wizard_reply_${sessionId}`)
          .setLabel("💬 Yanıtla")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`wizard_ai_detail_${sessionId}`)
          .setLabel("🤖 AI Detay")
          .setStyle(ButtonStyle.Secondary)
      );

      await devUser.send({ embeds: [dmEmbed], components: [dmRow] });
      console.log(`[ErrorWizard] ✅ Hata raporu ekonqtx'e gönderildi: ${sessionId}`);
    }
  } catch (err) {
    console.error("[ErrorWizard] DM gönderme hatası:", err.message);
  }

  // 4. Reply to reporter
  const replyEmbed = new EmbedBuilder()
    .setTitle("🧙 Hata Sihirbazı — Rapor Gönderildi!")
    .setColor(0x2ECC71)
    .setDescription(
      `✅ **Hata raporunuz başarıyla oluşturuldu ve geliştiriciye iletildi!**\n\n` +
      `**🤖 AI Analizi:**\n${aiAnalysis}\n\n` +
      `**📋 Rapor ID:** \`${sessionId}\``
    )
    .setFooter({ text: "Sentara Hata Sihirbazı • AI-Powered" })
    .setTimestamp();

  await interaction.editReply({ embeds: [replyEmbed] });
}

/**
 * Handle wizard button interactions
 */
async function handleWizardButton(interaction) {
  const customId = interaction.customId;

  // ── ONAYLA ──
  if (customId.startsWith("wizard_ack_")) {
    const sessionId = customId.replace("wizard_ack_", "");
    const session = activeWizardSessions.get(sessionId);
    if (session) session.status = "acknowledged";

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xF39C12)
      .setTitle("🧙 HATA SİHİRBAZI — Onaylandı ✅");

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wizard_ack_${sessionId}`).setLabel("✅ Onaylandı").setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId(`wizard_resolve_${sessionId}`).setLabel("🔧 Çözüldü").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`wizard_reply_${sessionId}`).setLabel("💬 Yanıtla").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`wizard_ai_detail_${sessionId}`).setLabel("🤖 AI Detay").setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });

    // Notify reporter
    if (session) {
      try {
        const reporter = await interaction.client.users.fetch(session.reporterId);
        await reporter.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🧙 Hata Sihirbazı — Güncelleme")
              .setColor(0xF39C12)
              .setDescription(`✅ Hata raporunuz (\`${sessionId}\`) geliştirici tarafından **onaylandı** ve incelemeye alındı!`)
              .setTimestamp()
          ]
        }).catch(() => {});
      } catch (_) {}
    }
    return;
  }

  // ── ÇÖZÜLDÜ ──
  if (customId.startsWith("wizard_resolve_")) {
    const sessionId = customId.replace("wizard_resolve_", "");
    const session = activeWizardSessions.get(sessionId);
    if (session) session.status = "resolved";

    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x2ECC71)
      .setTitle("🧙 HATA SİHİRBAZI — Çözüldü ✅");

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wizard_ack_${sessionId}`).setLabel("✅ Onaylandı").setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId(`wizard_resolve_${sessionId}`).setLabel("🔧 Çözüldü").setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId(`wizard_reply_${sessionId}`).setLabel("💬 Yanıtla").setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`wizard_ai_detail_${sessionId}`).setLabel("🤖 AI Detay").setStyle(ButtonStyle.Secondary).setDisabled(true)
    );

    await interaction.update({ embeds: [updatedEmbed], components: [disabledRow] });

    // Notify reporter
    if (session) {
      try {
        const reporter = await interaction.client.users.fetch(session.reporterId);
        await reporter.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("🧙 Hata Sihirbazı — Çözüldü! 🎉")
              .setColor(0x2ECC71)
              .setDescription(`✅ Hata raporunuz (\`${sessionId}\`) geliştirici tarafından **çözüldü** olarak işaretlendi!\n\nTeşekkür ederiz.`)
              .setTimestamp()
          ]
        }).catch(() => {});
      } catch (_) {}
    }
    return;
  }

  // ── YANITLA ──
  if (customId.startsWith("wizard_reply_")) {
    const sessionId = customId.replace("wizard_reply_", "");
    const session = activeWizardSessions.get(sessionId);

    const modal = new ModalBuilder()
      .setCustomId(`wizard_reply_modal_${sessionId}`)
      .setTitle("💬 Personele Yanıt Gönder");

    const replyRow = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("wizard_reply_text")
        .setLabel("Yanıtınız")
        .setPlaceholder("Personele göndermek istediğiniz mesajı yazın...")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    );

    modal.addComponents(replyRow);
    return interaction.showModal(modal);
  }

  // ── AI DETAY ──
  if (customId.startsWith("wizard_ai_detail_")) {
    const sessionId = customId.replace("wizard_ai_detail_", "");
    const session = activeWizardSessions.get(sessionId);
    
    if (!session) {
      return interaction.reply({ content: "❌ Bu rapor bulunamadı.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const detailPrompt = `Daha önce analiz ettiğin hatayı şimdi daha derinlemesine incele.

**Hata:** ${session.errorDesc}
**Sistem:** ${session.errorContext}
**Adımlar:** ${session.errorSteps}
**Önceki Analizin:** ${session.aiAnalysis}

Şimdi daha teknik ve detaylı bir analiz yap:
1. Olası kod seviyesi nedenler (hangi fonksiyon/modül bozuk olabilir)
2. Benzer hataların yaygın çözümleri
3. Debug için kontrol edilmesi gereken dosyalar/loglar
4. Aciliyet değerlendirmesi

Detaylı ve teknik yaz, maksimum 800 karakter.`;

      const detailedAnalysis = await chatWithAI(detailPrompt, ERROR_WIZARD_SYSTEM_PROMPT, 'ticket', { max_tokens: 900 });

      const detailEmbed = new EmbedBuilder()
        .setTitle("🤖 AI Detaylı Teknik Analiz")
        .setColor(0x9B59B6)
        .setDescription(detailedAnalysis)
        .setFooter({ text: `Rapor: ${sessionId}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [detailEmbed] });
    } catch (err) {
      await interaction.editReply({ content: `❌ AI detay analizi başarısız: ${err.message}` });
    }
    return;
  }
}

/**
 * Handle wizard reply modal submission
 */
async function handleWizardReplyModal(interaction) {
  const sessionId = interaction.customId.replace("wizard_reply_modal_", "");
  const session = activeWizardSessions.get(sessionId);
  
  if (!session) {
    return interaction.reply({ content: "❌ Rapor bulunamadı.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const replyText = interaction.fields.getTextInputValue("wizard_reply_text");

  try {
    const reporter = await interaction.client.users.fetch(session.reporterId);
    const replyEmbed = new EmbedBuilder()
      .setTitle("🧙 Hata Sihirbazı — Geliştirici Yanıtı")
      .setColor(0x3498DB)
      .setDescription(
        `**Raporunuz (\`${sessionId}\`) hakkında geliştirici yanıt verdi:**\n\n` +
        `> ${replyText}\n\n` +
        `**Orijinal Hatanız:** ${session.errorDesc.substring(0, 200)}...`
      )
      .setTimestamp()
      .setFooter({ text: "Sentara Hata Sihirbazı" });

    await reporter.send({ embeds: [replyEmbed] });
    await interaction.editReply({ content: `✅ Yanıtınız **${session.reporterTag}** kullanıcısına gönderildi!` });
  } catch (err) {
    await interaction.editReply({ content: `❌ Yanıt gönderilemedi: ${err.message}` });
  }
}

module.exports = {
  showErrorWizardModal,
  handleErrorWizardSubmit,
  handleWizardButton,
  handleWizardReplyModal,
  activeWizardSessions
};
