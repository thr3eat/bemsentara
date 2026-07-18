const {
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const Ticket = require("../../models/Ticket");
const { generateTicketId } = require("../../utils/ticketId");
const { SUPPORT_CATEGORIES, TARGET_GUILD_ID, TARGET_CHANNEL_ID, GUILD2_ID, GUILD2_TICKET_CATEGORY_ID, GUILD2_TICKET_LOG_ID, TMT_GUILD_ID } = require("../../config");
const {
  buildTicketEmbed,
  buildCloseButton,
  buildReopenAndRateRow,
} = require("../embeds");

async function handleModalSubmit(interaction) {
  // ── Kurallar Kabul Modal ───────────────────────────────────────────────────
  if (interaction.customId === 'rules_acceptance_modal') {
    const confirmation = interaction.fields.getTextInputValue('rules_confirm').toLowerCase().trim();
    
    if (confirmation !== 'evet' && confirmation !== 'yes') {
      return interaction.reply({
        content: '❌ Kuralları kabul etmek için "evet" yazmalısınız.',
        ephemeral: true
      });
    }

    try {
      const RulesAcceptance = require("../../models/RulesAcceptance");
      RulesAcceptance.accept(interaction.user.id, "1.0");

      const embed = new EmbedBuilder()
        .setTitle("✅ Kuralları Kabul Ettin!")
        .setDescription("Sentara'nın kurallarını kabul ettiğin için teşekkür ederiz.\n\nArtık botu tam olarak kullanabilirsin.")
        .setColor(0x2ecc71)
        .setFooter({ text: "Sentara" })
        .setTimestamp();

      return interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (err) {
      console.error("[rules_acceptance_modal]", err);
      return interaction.reply({
        content: '❌ Bir hata oluştu: ' + err.message,
        ephemeral: true
      });
    }
  }

  // ── Hata Sihirbazı Modal ──────────────────────────────────────────────────
  if (interaction.customId === 'error_wizard_modal') {
    const { handleErrorWizardSubmit } = require('../services/errorWizardService');
    return handleErrorWizardSubmit(interaction);
  }

  // ── Birim Talepleri ve Emirleri Modalleri ──────────────────────────────────
  if (interaction.customId.startsWith('modal_unit_')) {
    const { handleRequestModal } = require('../services/unitRequestService');
    return handleRequestModal(interaction);
  }

  if (interaction.customId.startsWith('wizard_reply_modal_')) {
    const { handleWizardReplyModal } = require('../services/errorWizardService');
    return handleWizardReplyModal(interaction);
  }

  // ── Soruşturma Sistemi Modalleri ───────────────────────────────────────────
  if (interaction.customId === 'investigation_start_modal') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const name = interaction.fields.getTextInputValue('investigation_name');
    const targetUserId = interaction.fields.getTextInputValue('investigation_target_id');
    const reason = interaction.fields.getTextInputValue('investigation_reason');

    const { startInvestigation } = require('../services/investigationService');
    await startInvestigation(interaction, name, targetUserId, reason);
    return;
  }

  if (interaction.customId.startsWith('invest_addmember_modal_')) {
    const channelId = interaction.customId.replace('invest_addmember_modal_', '');
    const userId = interaction.fields.getTextInputValue('member_id');
    const { addMemberToInvestigation } = require('../services/investigationService');
    await addMemberToInvestigation(interaction, channelId, userId);
    return;
  }

  if (interaction.customId.startsWith('invest_removemember_modal_')) {
    const channelId = interaction.customId.replace('invest_removemember_modal_', '');
    const userId = interaction.fields.getTextInputValue('member_id');
    const { removeMemberFromInvestigation } = require('../services/investigationService');
    await removeMemberFromInvestigation(interaction, channelId, userId);
    return;
  }

  if (interaction.customId.startsWith('invest_penalty_detail_modal_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const parts = interaction.customId.replace('invest_penalty_detail_modal_', '').split('_');
    const channelId = parts[0];
    const penaltyType = parts[1];
    const duration = interaction.fields.getTextInputValue('penalty_duration');

    const { resolveInvestigation } = require('../services/investigationService');
    await resolveInvestigation(interaction, channelId, penaltyType, duration);
    return;
  }

  if (interaction.customId === 'modal_answer_coach') {
    await interaction.deferUpdate().catch(() => {});
    const answer = interaction.fields.getTextInputValue('coach_answer_input');

    const StaffProgress = require("../../models/StaffProgress");
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p || !p.currentQuestion) return;

    // Save answer to memory
    p.coachMemory = p.coachMemory || new Map();
    p.coachMemory.set(p.currentQuestionKey, answer);

    // Clear current question
    p.currentQuestion = '';
    p.currentQuestionKey = '';
    await p.save();

    // Re-generate task embed and components
    const { generateMorningBriefingEmbed, getMorningBriefingComponents } = require("../services/staffSystem");
    const embed = await generateMorningBriefingEmbed(p, interaction.client);
    const components = await getMorningBriefingComponents(p);

    // Edit message in-place
    await interaction.editReply({ embeds: [embed], components }).catch(() => {});

    // Send DM confirmation from coach
    await interaction.user.send(`🤖 **Koç:** *"Cevabını hafızama kaydettim: **${answer}**. Seni daha yakından tanımak güzel, moderatör efendi!"*`).catch(() => {});
    return;
  }

  // ── AI Asistanı Modal Submit ───────────────────────────────────────────────
  if (interaction.customId === 'modal_staff_ai_assistant') {
    const query = interaction.fields.getTextInputValue('assistant_query');
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const { chatWithAI } = require('../services/staffSystem');
      const systemPrompt = `Sen EkoYıldız sunucusunun AI Moderasyon Asistanısın. Sunucu kuralları ve moderasyon politikası dahilinde moderatörlerimize rehberlik ediyorsun.
İşte genel sunucu politikası:
- Küfür/hakaret: 1. ihlal UYARI veya 15-30 dk Mute, tekrarı halinde daha uzun Mute/Cezalandırma.
- Reklam/Link: Sınırsız MUTE veya BAN.
- Spam: 15 dk Mute.
- Dini/Milli değerlere saygısızlık veya ırkçılık: Anında BAN.
- Yönetime hakaret: Cezalandırma/Mute.

Moderatörün karşılaştığı durumu analiz et ve yapılması gereken işlemi (uyarı, susturma süresi, ban vb.) net, maddeler halinde ve profesyonelce tavsiye et.`;

      const aiResponse = await chatWithAI([{ role: 'user', content: query }], systemPrompt).catch(() => 'AI asistanı şu anda yanıt veremiyor, lütfen kuralları kontrol edin.');
      const cleanedResponse = aiResponse?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'AI asistanı yanıt veremedi.';

      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle('🤖 AI Moderasyon Asistanı Raporu')
        .setDescription(`**Sorduğunuz Durum:**\n> *"${query}"*\n\n**🤖 AI Asistan Önerisi:**\n${cleanedResponse}`)
        .setFooter({ text: 'Eko Yıldız • AI Rehberlik Servisi' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[AI-Assistant] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── Vaka Raporu Modal Submit ──────────────────────────────────────────────
  if (interaction.customId === 'modal_staff_incident_report') {
    const target = interaction.fields.getTextInputValue('incident_target');
    const description = interaction.fields.getTextInputValue('incident_description');
    await interaction.deferReply({ ephemeral: true });

    try {
      const { GUILD2_ID } = require('../../config');
      const guild = await interaction.client.guilds.fetch(GUILD2_ID).catch(() => null);
      if (guild) {
        let logChan = guild.channels.cache.find(c => c.name === 'yetkili-rapor-log');
        if (!logChan) {
          logChan = await guild.channels.create({
            name: 'yetkili-rapor-log',
            type: 0,
            parent: "1518692460233228431",
            topic: 'Yetkililerin vaka ve durum raporları.'
          }).catch(() => null);
        }
        
        if (logChan) {
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('🚨 Yeni Vaka Raporu')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields(
              { name: '👤 Raporlayan Yetkili', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
              { name: '👤 Olayla İlgili Kişi', value: `\`${target}\``, inline: true },
              { name: '📝 Olay Açıklaması', value: `\`\`\`${description}\`\`\``, inline: false }
            )
            .setTimestamp();
          await logChan.send({ embeds: [embed] });
        }
      }
      return interaction.editReply({ content: '✅ **Vaka raporunuz başarıyla üst yönetimin log kanallarına iletilmiştir!** Geri bildiriminiz için teşekkürler. 🫡' });
    } catch (err) {
      console.error('[Incident-Report] Hata:', err.message);
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  // ── Yetkili Modalleri (V6.0) ──────────────────────────────────────────────
  if (interaction.customId === 'modal_staff_daily_report') {
    const reportContent = interaction.fields.getTextInputValue('report_content');
    await interaction.deferReply({ ephemeral: true });
    
    const StaffProgress = require('../../models/StaffProgress');
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) return interaction.editReply({ content: '❌ Personel kaydınız bulunamadı.' });

    const { getDailyTaskCompletionStats, chatWithAI, PERSONAL_ASSISTANT_SYSTEM_PROMPT, todayStr } = require('../services/staffSystem');
    const stats = getDailyTaskCompletionStats(p);

    const prompt = `Aşağıdaki yetkilinin bugünkü aktiviteleri ve girdiği günlük rapor hakkında yapıcı, profesyonel bir analiz yap.
    - Personel: <@${interaction.user.id}>
    - Bugün selamlanan üye sayısı: ${p.daily?.greetCount || 0}
    - Bugün sesli kanalda geçirilen süre: ${p.daily?.voiceMinutes || 0} dakika
    - Seçmeli görev tamamlandı mı: ${p.daily?.chosenTaskCompleted ? 'Evet' : 'Hayır'}
    - Yetkilinin girdiği Rapor: "${reportContent}"
    
    Lütfen yetkiliye hitaben yapıcı, motive edici ve geri bildirim içeren kısa (maksimum 3-4 cümle) bir yanıt yaz.`;

    const aiResponse = await chatWithAI([{ role: 'user', content: prompt }], PERSONAL_ASSISTANT_SYSTEM_PROMPT).catch(() => 'Raporunuz başarıyla alındı ve kaydedildi.');
    const cleanedResponse = aiResponse?.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || 'Raporunuz başarıyla alındı ve kaydedildi.';

    p.stats.weeklyReports = (p.stats.weeklyReports || 0) + 1;
    p.stats.lastCompleteDay = todayStr();
    await p.save().catch(() => {});

    try {
      const { GUILD2_ID } = require('../../config');
      const guild = await interaction.client.guilds.fetch(GUILD2_ID).catch(() => null);
      if (guild) {
        let reportChan = guild.channels.cache.find(c => c.name === 'yetkili-rapor-log');
        if (!reportChan) {
          reportChan = await guild.channels.create({
            name: 'yetkili-rapor-log',
            type: 0,
            parent: "1518692460233228431",
            topic: 'Yetkililerin günlük girdiği çalışma raporları.'
          }).catch(() => null);
        }
        if (reportChan) {
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('📝 Yeni Günlük Görev Raporu')
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .addFields(
              { name: '👤 Gönderen Yetkili', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`, inline: true },
              { name: '📊 Bugün Sesli Aktiflik', value: `${p.daily?.voiceMinutes || 0} dakika`, inline: true },
              { name: '🎫 Bilet Çözümü', value: `${p.daily?.ticketsSolvedToday || 0} adet`, inline: true },
              { name: '📝 Rapor Detayı', value: `\`\`\`${reportContent}\`\`\``, inline: false },
              { name: '🤖 AI Koç Değerlendirmesi', value: `> *"${cleanedResponse}"*`, inline: false }
            )
            .setTimestamp();
          await reportChan.send({ embeds: [embed] });
        }
      }
    } catch (_) {}

    return interaction.editReply({
      content: `📝 **Günlük Görev Raporunuz Gönderildi!**\n\n🤖 **AI Koç Değerlendirmesi:**\n${cleanedResponse}`
    });
  }

  if (interaction.customId === 'modal_staff_resign') {
    const reason = interaction.fields.getTextInputValue('resign_reason');
    await interaction.deferReply({ ephemeral: true });
    try {
      const { resignFromStaff } = require('../services/staffSystem');
      const result = await resignFromStaff(interaction.user.id, reason, interaction.client);
      if (!result.success) return interaction.editReply({ content: `❌ ${result.message}` });
      let msg = '';
      if (result.canRetire) {
        msg = `✅ İstifan kabul edildi. 90+ gün aktif kaldığın için emeklilik statüsüne geçtiniz! Kaydınız sistemde korunmaktadır.\nAnasayfa panelinizden veya \`/emeklilik\` kullanarak resmi olarak emekli olabilirsiniz.`;
      } else if (result.recordDeleted) {
        msg = `✅ İstifan kabul edildi ve kaydın tamamen silinmiştir. Tekrar başvurmak istersen yöneticilere yazabilirsin.`;
      } else {
        msg = `✅ İstifan kabul edildi. Teşekkürler!`;
      }
      return interaction.editReply({ content: msg });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (interaction.customId === 'modal_staff_warn') {
    const targetUserId = interaction.fields.getTextInputValue('warn_user_id');
    const reason = interaction.fields.getTextInputValue('warn_reason');
    await interaction.deferReply({ ephemeral: true });
    try {
      const { addDisciplinaryWarn } = require('../services/staffDutyService');
      const result = await addDisciplinaryWarn(targetUserId, reason, interaction.user.tag);
      if (!result.success) return interaction.editReply({ content: `❌ Başarısız: ${result.error}` });

      try {
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        if (targetUser) {
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("⚠️ Resmi Sicil Uyarısı / Disiplin Cezası")
            .setDescription(
              `Merhaba <@${targetUserId}>,\n\n` +
              `Yönetim tarafından sicilinize resmi bir **disiplin uyarısı** işlenmiştir.\n\n` +
              `📝 **Gerekçe:** ${reason}\n` +
              `🛡️ **Uyarıyı Veren:** ${interaction.user.toString()}\n` +
              `📊 **Yeni Performans KPI Puanınız:** \`${result.newKpi}/100\`\n\n` +
              `*Disiplin uyarıları terfilerinizi olumsuz etkileyeceği gibi, tekrarı halinde kadro dışı bırakılma sebebi teşkil eder.*`
            )
            .setFooter({ text: "Eko Yıldız • Disiplin ve Sicil Kurulu" })
            .setTimestamp();
          await targetUser.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (_) {}

      return interaction.editReply({ content: `✅ **Disiplin Uyarısı Eklendi!**\n👤 **Hedef Yetkili:** <@${targetUserId}>\n📝 **Gerekçe:** \`${reason}\`\n📊 **Yeni Performans KPI:** \`${result.newKpi}/100\`` });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (interaction.customId === 'modal_staff_commend') {
    const targetUserId = interaction.fields.getTextInputValue('commend_user_id');
    const reason = interaction.fields.getTextInputValue('commend_reason');
    await interaction.deferReply({ ephemeral: true });
    try {
      const { addCommendation } = require('../services/staffDutyService');
      const result = await addCommendation(targetUserId, reason, interaction.user.tag);
      if (!result.success) return interaction.editReply({ content: `❌ Başarısız: ${result.error}` });

      try {
        const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
        if (targetUser) {
          const { EmbedBuilder } = require('discord.js');
          const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("💚 Resmi Takdir / Teşekkür Belgesi")
            .setDescription(
              `Merhaba <@${targetUserId}>,\n\n` +
              `Sunucumuza yapmış olduğunuz özverili katkılar ve üstün başarılarınızdan dolayı yönetim tarafından sicilinize resmi bir **Takdir/Teşekkür Belgesi** işlenmiştir! 🎉\n\n` +
              `📝 **Gerekçe:** ${reason}\n` +
              `🛡️ **Takdiri Veren:** ${interaction.user.toString()}\n` +
              `📊 **Yeni Performans KPI Puanınız:** \`${result.newKpi}/100\`\n\n` +
              `*Tebrik eder, başarılarınızın devamını dileriz!*`
            )
            .setFooter({ text: "Eko Yıldız • Personel Teşvik Kurulu" })
            .setTimestamp();
          await targetUser.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (_) {}

      return interaction.editReply({ content: `✅ **Takdir/Teşekkür Belgesi Eklendi!**\n👤 **Hedef Yetkili:** <@${targetUserId}>\n📝 **Gerekçe:** \`${reason}\`\n📊 **Yeni Performans KPI:** \`${result.newKpi}/100\`` });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (interaction.customId === 'modal_staff_sicil') {
    const targetUserId = interaction.fields.getTextInputValue('sicil_user_id');
    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: targetUserId });
      if (!p) return interaction.editReply({ content: '❌ Belirtilen kullanıcı personel sisteminde kayıtlı değil.' });

      const { calculateKpi, getKpiGrade } = require('../services/staffDutyService');
      const kpiScore = calculateKpi(p);
      const kpiGrade = getKpiGrade(kpiScore);

      const warns = p.disciplinary?.warns || [];
      const comms = p.disciplinary?.commendations || [];

      let dutyText = '';
      if (p.duty?.isActive && p.duty.startedAt) {
        const elapsedMins = Math.floor((Date.now() - new Date(p.duty.startedAt).getTime()) / 1000 / 60);
        const elapsedHrs = Math.floor(elapsedMins / 60);
        const elapsedRemainingMins = elapsedMins % 60;
        dutyText += `🟢 **Nöbet Durumu:** ⚡ AKTİF NÖBETTE (${elapsedHrs} sa ${elapsedRemainingMins} dk)\n🎙️ **Ses:** ${p.duty.sessionVoiceMinutes || 0} dk | 🎫 **Bilet:** ${p.duty.sessionTicketsSolved || 0} | 🛡️ **Mod:** ${p.duty.sessionModerationActions || 0}\n`;
      } else {
        dutyText += `🔴 **Nöbet Durumu:** 💤 Serbest Zaman\n`;
      }

      let commsText = comms.length > 0
        ? comms.map((c, i) => `**${i + 1}.** — Gerekçe: \`${c.reason}\` (Veren: *${c.issuedBy}*)`).join('\n')
        : '*Teşekkür veya takdir belgesi bulunmuyor.*';

      let warnsText = warns.length > 0
        ? warns.map((w, i) => `**${i + 1}.** — Gerekçe: \`${w.reason}\` (Veren: *${w.issuedBy}*)`).join('\n')
        : '*Disiplin uyarısı bulunmuyor.*';

      const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);
      const nameStr = targetUser ? targetUser.tag : targetUserId;

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setColor(kpiGrade.color)
        .setTitle(`📋 Personel Sicil ve Performans Raporu`)
        .setDescription(`**Personel:** <@${targetUserId}> (\`${nameStr}\`)\n**Seviye/Rütbe:** Seviye ${p.level}`)
        .addFields(
          { name: '📊 Performans Puanı (KPI)', value: `\`${kpiScore}/100\`\n**Değerlendirme:** ${kpiGrade.label}`, inline: false },
          { name: '⚡ Nöbet Bilgileri', value: dutyText, inline: false },
          { name: '💚 Takdir ve Teşekkür Belgeleri', value: commsText, inline: false },
          { name: '⚠️ Resmi Disiplin Uyarıları', value: warnsText, inline: false }
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (interaction.customId === 'modal_staff_dismiss') {
    const targetUserId = interaction.fields.getTextInputValue('dismiss_user_id');
    const reason = interaction.fields.getTextInputValue('dismiss_reason');
    await interaction.deferReply({ ephemeral: true });
    try {
      const { dismissStaff } = require('../services/staffSystem');
      const result = await dismissStaff(targetUserId, reason, interaction.user.id, interaction.client);
      if (!result.success) return interaction.editReply({ content: `❌ Başarısız: ${result.message}` });
      return interaction.editReply({ content: `✅ **Personel Başarıyla Kovuldu!**\n👤 **Kullanıcı:** <@${targetUserId}>\n📝 **Neden:** \`${reason}\`` });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (interaction.customId === 'modal_staff_set_stats') {
    const targetUserId = interaction.fields.getTextInputValue('stats_user_id');
    const parameter = interaction.fields.getTextInputValue('stats_parameter').trim().toLowerCase();
    const valStr = interaction.fields.getTextInputValue('stats_value');
    const val = parseInt(valStr, 10);

    if (isNaN(val) || val < 0) {
      return interaction.reply({ content: '❌ Girdiğiniz yeni değer geçerli bir pozitif tam sayı olmalıdır!', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const StaffProgress = require('../../models/StaffProgress');
      const p = await StaffProgress.findOne({ userId: targetUserId });
      if (!p) return interaction.editReply({ content: '❌ Belirtilen kullanıcı personel sisteminde kayıtlı değil.' });

      if (!p.stats) p.stats = {};

      let oldValue = '';
      let newValue = '';
      
      if (parameter === 'tickets') {
        oldValue = `${p.stats.ticketsSolved || 0} bilet`;
        p.stats.ticketsSolved = val;
        newValue = `${val} bilet`;
      } else if (parameter === 'messages') {
        oldValue = `${p.stats.chatMessages || 0} mesaj`;
        p.stats.chatMessages = val;
        newValue = `${val} mesaj`;
      } else if (parameter === 'voice') {
        oldValue = `${p.stats.totalVoiceMinutes || 0} dakika`;
        p.stats.totalVoiceMinutes = val;
        newValue = `${val} dakika`;
      } else {
        return interaction.editReply({ content: '❌ Geçersiz parametre! Sadece `tickets`, `messages` veya `voice` girebilirsiniz.' });
      }

      await p.save();
      return interaction.editReply({ content: `✅ **Personel İstatistikleri Güncellendi!**\n👤 **Kullanıcı:** <@${targetUserId}>\n⚙️ **Değişiklik:** \`${parameter}\`: \`${oldValue}\` ➔ \`${newValue}\`` });
    } catch (err) {
      return interaction.editReply({ content: `❌ Hata: ${err.message}` });
    }
  }

  if (interaction.customId === 'modal_inactivity_support') {
    const { handleInactivitySupportModal } = require('../services/staffSystem');
    return handleInactivitySupportModal(interaction, interaction.client);
  }

  if (interaction.customId === 'modal_inactivity_proof') {
    const { handleInactivityProofModal } = require('../services/staffSystem');
    return handleInactivityProofModal(interaction, interaction.client);
  }

  if (interaction.customId.startsWith('setup_branch_modal_')) {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const targetGuildId = interaction.customId.replace('setup_branch_modal_', '');

    const chefVal = interaction.fields.getTextInputValue('branch_chef_input');
    const assistantVal = interaction.fields.getTextInputValue('branch_chef_assistant_input');

    const ServerSetup = require('../../models/ServerSetup');
    const setupDoc = await ServerSetup.findOne({ guildId: targetGuildId });
    if (!setupDoc) {
      return interaction.editReply({ content: '❌ Kurulum verisi bulunamadı.' });
    }

    setupDoc.branchChef = chefVal;
    setupDoc.branchChefAssistant = assistantVal;
    await setupDoc.save();

    const client = interaction.client;
    
    // Update branch rules message
    try {
      const targetGuild = client.guilds.cache.get(targetGuildId)
        || await client.guilds.fetch(targetGuildId).catch(() => null);
      if (targetGuild && setupDoc.rulesChannelId) {
        const rulesChan = targetGuild.channels.cache.get(setupDoc.rulesChannelId)
          || await targetGuild.channels.fetch(setupDoc.rulesChannelId).catch(() => null);
        if (rulesChan && rulesChan.isTextBased()) {
          const rulesEmbed = new EmbedBuilder()
            .setTitle("📜 TMT SUNUCU KURALLARI VE YÖNETİMİ")
            .setColor(0x2c3e50)
            .setDescription(
              `Merhaba! Sunucumuza hoş geldiniz. Lütfen aşağıdaki kurallara ve yönetim kadrosuna dikkat edin:\n\n` +
              `**1.** Sunucu içerisinde saygılı ve ahlaki kurallara uygun davranmak zorunludur.\n` +
              `**2.** Reklam, spam ve sabotaj (abuse) girişimleri en ağır şekilde cezalandırılacaktır.\n` +
              `**3.** Roblox rütbenizi eşitlemek için lütfen doğrulama kanalını kullanın.\n\n` +
              `👑 **BRANŞ YÖNETİM KADROSU:**\n` +
              `• **BRANŞ ŞEFİ:** ${setupDoc.branchChef ? (setupDoc.branchChef.match(/^\d+$/) ? `<@${setupDoc.branchChef}>` : setupDoc.branchChef) : "Bilinmiyor"}\n` +
              `• **BRANŞ ŞEF YARDIMCISI:** ${setupDoc.branchChefAssistant ? (setupDoc.branchChefAssistant.match(/^\d+$/) ? `<@${setupDoc.branchChefAssistant}>` : setupDoc.branchChefAssistant) : "Bilinmiyor"}\n`
            )
            .setTimestamp()
            .setFooter({ text: "TMT Yönetim Departmanı" });

          const msgs = await rulesChan.messages.fetch({ limit: 50 }).catch(() => []);
          const botMsg = msgs.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes("TMT SUNUCU KURALLARI"));
          if (botMsg) {
            await botMsg.edit({ embeds: [rulesEmbed] }).catch(() => {});
          } else {
            await rulesChan.send({ embeds: [rulesEmbed] }).catch(() => {});
          }
        }
      }
    } catch (rulesErr) {
      console.error('[SunucuKurma] Error updating branch rules message:', rulesErr.message);
    }

    // Update central lists channel
    try {
      const centralGuild = client.guilds.cache.get("1483482948320891074")
        || await client.guilds.fetch("1483482948320891074").catch(() => null);
      if (centralGuild) {
        const listChan = centralGuild.channels.cache.get("1521516376831823973")
          || await centralGuild.channels.fetch("1521516376831823973").catch(() => null);
        if (listChan && listChan.isTextBased()) {
          const activeSetups = await ServerSetup.find({ status: "active" });
          const listEmbed = new EmbedBuilder()
            .setTitle("🏢 KURULAN BRANŞ SUNUCULARI LİSTESİ")
            .setColor(0x1abc9c)
            .setDescription(
              "Aşağıdaki listeden dilediğiniz branş sunucusunu seçip, Branş Şefi ve Branş Şef Yardımcısı atamalarını güncelleyebilirsiniz.\n\n" +
              activeSetups.map(s => `• **${s.guildName}** (Grup: \`${s.robloxGroupName}\`)\n  > Şef: ${s.branchChef ? (s.branchChef.match(/^\d+$/) ? `<@${s.branchChef}>` : s.branchChef) : "Yok"}\n  > Yardımcı: ${s.branchChefAssistant ? (s.branchChefAssistant.match(/^\d+$/) ? `<@${s.branchChefAssistant}>` : s.branchChefAssistant) : "Yok"}`).join("\n\n")
            )
            .setTimestamp();
            
          const msgs = await listChan.messages.fetch({ limit: 50 }).catch(() => []);
          const botMsg = msgs.find(m => m.author.id === client.user.id && m.embeds[0]?.title?.includes("KURULAN BRANŞ SUNUCULARI"));
          if (botMsg) {
            const { StringSelectMenuBuilder } = require('discord.js');
            const options = activeSetups.map(s => ({
              label: s.guildName,
              description: `${s.robloxGroupName} Grubu Sunucusu`,
              value: s.guildId
            })).slice(0, 25);
            
            const listComponents = [];
            if (options.length > 0) {
              listComponents.push(
                new ActionRowBuilder().addComponents(
                  new StringSelectMenuBuilder()
                    .setCustomId("setup_central_branch_select")
                    .setPlaceholder("Branş Seçin...")
                    .addOptions(options)
                )
              );
            }
            await botMsg.edit({ embeds: [listEmbed], components: listComponents }).catch(() => {});
          }
        }
      }
    } catch (centralErr) {
      console.error('[SunucuKurma] Error updating central panel message:', centralErr.message);
    }

    return interaction.editReply({ content: '✅ Branş yöneticileri başarıyla güncellendi!' });
  }

  if (interaction.customId === 'ekocoin_convert_xp_modal') {
    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    
    const amountStr = interaction.fields.getTextInputValue('convert_amount');
    const amount = parseInt(amountStr, 10);
    
    if (isNaN(amount) || amount <= 0) {
      return interaction.editReply({ content: '❌ Geçersiz miktar! Lütfen pozitif bir sayı girin.' });
    }
    
    const StaffProgress = require('../../models/StaffProgress');
    const p = await StaffProgress.findOne({ userId: interaction.user.id });
    if (!p) {
      return interaction.editReply({ content: '❌ Personel kaydınız bulunamadı.' });
    }
    
    const currentCoins = p.gamification?.ecoCoins || 0;
    if (currentCoins < amount) {
      return interaction.editReply({ content: `❌ Yetersiz EkoCoin! Mevcut bakiyeniz: \`${currentCoins} E.C.\`` });
    }
    
    const xpReward = Math.floor(amount * 0.25);
    if (xpReward <= 0) {
      return interaction.editReply({ content: `❌ Bu miktardaki EkoCoin sıfır XP ediyor. Lütfen en az 4 EkoCoin girin (1 EkoCoin = 0.25 XP).` });
    }
    
    // Deduct EkoCoins
    p.gamification.ecoCoins -= amount;
    await p.save();
    
    // Add XP
    const { addXPDirectly } = require('../services/frogLevel');
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (member) {
      await addXPDirectly(member, xpReward, interaction.client);
    }
    
    return interaction.editReply({
      content: `✅ **Başarı!** \`${amount} E.C.\` bozdurularak **${xpReward} XP** elde edildi!\nGüncel Bakiyeniz: \`${p.gamification.ecoCoins} E.C.\``
    });
  }

  if (interaction.customId.startsWith('panel_modal_')) {
    const { handlePanelModal } = require("../services/mainPanelService");
    return handlePanelModal(interaction);
  }

  // ── Ticket oluşturma modal'ı ─────────────────────────────────────────────
  if (interaction.customId === "ekoyildiz_reklam_form_modal") {
    const { handleReklamModalSubmit } = require("../services/reklamTicketService");
    return handleReklamModalSubmit(interaction);
  }

  if (interaction.customId.startsWith("ekoyildiz_eposta_form_modal_")) {
    const category = interaction.customId.replace("ekoyildiz_eposta_form_modal_", "");
    const { handleEpostaModalSubmit } = require("../services/epostaTicketService");
    return handleEpostaModalSubmit(interaction, category);
  }

  if (interaction.customId.startsWith("eposta_add_user_modal_")) {
    const ticketId = interaction.customId.replace("eposta_add_user_modal_", "");
    const targetInput = interaction.fields.getTextInputValue("target_user_input").trim();

    await interaction.reply({ content: "⏳ Kullanıcı bulunuyor ve gruba ekleniyor...", ephemeral: true });

    const Ticket = require("../../models/Ticket");
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return interaction.followUp({ content: "❌ Hata: E-posta bulunamadı.", ephemeral: true });

    let targetUser = null;
    if (/^\d{17,20}$/.test(targetInput)) {
      targetUser = await interaction.client.users.fetch(targetInput).catch(() => null);
    } else {
      const guild = await interaction.client.guilds.fetch(ticket.guildId).catch(() => null);
      if (guild) {
        const members = await guild.members.fetch().catch(() => []);
        const foundMember = members.find(m => m.user.username.toLowerCase() === targetInput.toLowerCase() || m.user.displayName.toLowerCase() === targetInput.toLowerCase());
        if (foundMember) targetUser = foundMember.user;
      }
    }

    if (!targetUser) {
      return interaction.followUp({ content: "❌ Hata: Belirtilen kullanıcı bulunamadı. Lütfen doğru ID veya Discord kullanıcı adını girin.", ephemeral: true });
    }

    if (targetUser.id === ticket.userId) {
      return interaction.followUp({ content: "❌ Hata: Bu kullanıcı zaten e-postanın sahibi.", ephemeral: true });
    }
    if (ticket.additionalUsers && ticket.additionalUsers.includes(targetUser.id)) {
      return interaction.followUp({ content: "❌ Hata: Bu kullanıcı zaten gruba eklenmiş.", ephemeral: true });
    }

    try {
      const guild = await interaction.client.guilds.fetch(ticket.guildId);
      const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const { GUILD2_TICKET_CATEGORY_ID } = require("../../config");

      const userPermissions = [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: targetUser.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        }
      ];

      const newChannel = await guild.channels.create({
        name: `eposta-${targetUser.username.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: GUILD2_TICKET_CATEGORY_ID || undefined,
        permissionOverwrites: userPermissions,
      });

      ticket.additionalUsers = ticket.additionalUsers || [];
      ticket.additionalUsers.push(targetUser.id);
      ticket.additionalChannels = ticket.additionalChannels || [];
      ticket.additionalChannels.push(newChannel.id);
      await ticket.save();

      const addedEmbed = new EmbedBuilder()
        .setTitle("📨 GÖNDERİLEN E-POSTA KUTUSU (Grup Görüşmesi)")
        .setDescription(
          `Merhaba <@${targetUser.id}>,\n` +
          `<@${interaction.user.id}> sizi **${ticket.subject}** konulu destek e-posta grubuna ekledi.\n\n` +
          `💬 **Nasıl Çalışır?**\n` +
          `Bu kanala yazacağınız her şey destek ekibimize ve diğer grup üyelerine iletilir.\n\n` +
          `Gruptan çıkmak isterseniz aşağıdaki butona basarak onay talep edebilirsiniz.`
        )
        .setColor(0x3498db)
        .setTimestamp();

      const rowLeave = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`eposta_leave_ticket_${ticketId}`)
          .setLabel("🚪 TİCKETDEN ÇIKMAK İSTİYORUM")
          .setStyle(ButtonStyle.Danger)
      );

      await newChannel.send({ embeds: [addedEmbed], components: [rowLeave] });

      if (ticket.userChannelId) {
        const mainChan = await guild.channels.fetch(ticket.userChannelId).catch(() => null);
        if (mainChan) await mainChan.send(`➕ <@${targetUser.id}> görüşmeye e-posta adresi eklenerek dahil edildi.`);
      }
      const modChan = await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (modChan) await modChan.send(`➕ <@${targetUser.id}> görüşmeye e-posta adresi eklenerek dahil edildi.`);

      return interaction.followUp({ content: `✅ <@${targetUser.id}> başarıyla görüşmeye eklendi ve özel e-posta kanalı oluşturuldu.`, ephemeral: true });

    } catch (err) {
      console.error("[eposta_add_user_modal] Error:", err.message);
      return interaction.followUp({ content: `❌ Hata: Kanal oluşturulamadı. ${err.message}`, ephemeral: true });
    }
  }

  if (interaction.customId.startsWith("support_modal_") || interaction.customId.startsWith("tmt_support_modal_") || interaction.customId.startsWith("ekoyildiz_support_modal_")) {
    return handleSupportModal(interaction);
  }

  // ── Ticket kapatma sebebi modal'ı ────────────────────────────────────────
  if (interaction.customId.startsWith("close_reason_modal_")) {
    return handleCloseReasonModal(interaction);
  }

  // ── Değerlendirme modal'ı ────────────────────────────────────────────────
  if (interaction.customId.startsWith("rating_modal_")) {
    return handleRatingModal(interaction);
  }

  // ── Abone Rolü Kaldırma / Reddetme Sebebi modal'ı ──────────────────────
  if (interaction.customId.startsWith("abone_reason_") || interaction.customId.startsWith("abone_reject_reason_")) {
    try {
      const { handleRemoveSubscriberModal } = require('../services/photoVerification');
      await handleRemoveSubscriberModal(interaction, interaction.client);
    } catch (err) {
      console.error('[photoVerification] Modal hata:', err.message);
      try {
        const { sendErrorReplyWithButton } = require('../services/errorReporter');
        await sendErrorReplyWithButton(interaction, err, "modalHandler photoVerification");
      } catch (reporterErr) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true }).catch(() => {});
        }
      }
    }
    return null;
  }

  // ── Admin Panel Form Modals ─────────────────────────────────────────────
  if (['modal_leave_form', 'modal_suggestion_form', 'modal_resign_form', 'modal_modaction_form', 'modal_ban_report_form', 'modal_mute_report_form', 'modal_mod_complain_form'].includes(interaction.customId)) {
    try {
      const { handleAdminFormModals } = require('../services/adminFormHandler');
      await handleAdminFormModals(interaction, interaction.client);
    } catch (err) {
      console.error('[AdminForm] Modal hata:', err.message);
      try {
        const { sendErrorReplyWithButton } = require('../services/errorReporter');
        await sendErrorReplyWithButton(interaction, err, "modalHandler AdminForm");
      } catch (reporterErr) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true }).catch(() => {});
        }
      }
    }
    return null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Yeni ticket oluşturma
// ─────────────────────────────────────────────────────────────────────────────
async function handleSupportModal(interaction) {
  const isTMT = interaction.customId.startsWith("tmt_support_modal_");
  const isEko = interaction.customId.startsWith("ekoyildiz_support_modal_");
  const category = interaction.customId
    .replace("support_modal_", "")
    .replace("tmt_support_modal_", "")
    .replace("ekoyildiz_support_modal_", "");
  const subject = interaction.fields.getTextInputValue("support_subject");
  const description = interaction.fields.getTextInputValue("support_description");

  // ── YENİ STAJYER GÜVENLİK ──────────────────────────────────────────────────
  // Stajyer/yeni moderatörlerin abuse yapmasını engelle
  try {
    const { StaffProgress } = require('../services/staffSystem');
    const StaffModel = require('../../models/StaffProgress');
    
    const staff = await StaffModel.findOne({ userId: interaction.user.id });
    const joinedAt = staff?.joinedAt || new Date();
    const hoursWorked = (Date.now() - new Date(joinedAt).getTime()) / (1000 * 60 * 60);
    
    // Yeni stajyer (< 24 saat)
    if (hoursWorked < 24 && staff?.level === 1) {
      // Bugünkü ticket sayısını kontrol et
      const today = new Date().toISOString().split('T')[0];
      const todayTickets = await Ticket.find({
        userId: interaction.user.id,
        createdAt: { $gte: new Date(today) },
      });
      
      if (todayTickets.length >= 2) {
        await interaction.reply({
          content: `❌ **Stajyer Güvenlik:** Günde maksimum 2 ticket açabilirsin (açılmış: ${todayTickets.length}/2)\n\nSunucuyu spamdan korumak için bu kuralımız var. Lütfen sonra tekrar dene!`,
          ephemeral: true,
        });
        return;
      }
    }
  } catch (_) {
    // Kontrol başarısız olursa devam et (güvenlik basit tutal)
  }

  // Kategori bazlı otomatik öncelik
  const autoPriority = {
    ban:       'high',
    report:    'high',
    reklam:    'medium',
    billing:   'high',
    technical: 'medium',
    account:   'medium',
    genel:     'low',
    other:     'low',
  };
  const priority = autoPriority[category] || 'medium';

  try {
    const ticketId = generateTicketId();

    // Hangi sunucudan geldiğini belirle
    const sourceGuildId = interaction.guild?.id;
    const isGuild2 = sourceGuildId === GUILD2_ID || isEko;
    const isAllied = sourceGuildId === "1483482948320891074";

    // Hedef sunucu: TMT ise TMT sunucusu, Guild2 ise Guild2, Allied ise Allied, yoksa Target Guild
    let targetGuildId = TARGET_GUILD_ID;
    if (isAllied) targetGuildId = "1483482948320891074";
    else if (isTMT) targetGuildId = TMT_GUILD_ID;
    else if (isGuild2) targetGuildId = GUILD2_ID;

    const targetGuild = await interaction.client.guilds.fetch(targetGuildId);
    if (!targetGuild) throw new Error("Hedef sunucu bulunamadı.");

    let ticketChannel;
    const permissionOverwrites = [
      { id: targetGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // ── TÜM MODERAT/PERSONEL ROLLERINI EKLE (ticket görülebilsin) ──────────
    try {
      const { ROLES } = require("../services/staffSystem");
      const STAFF_ROLES = ROLES;
      
      for (const roleId of Object.values(STAFF_ROLES)) {
        if (roleId && targetGuild.roles.cache.has(roleId)) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          });
        }
      }
    } catch (_) {}

    // Geçersiz ID'leri filtrele
    const validOverwrites = permissionOverwrites.filter(o => o.id);

    if (isGuild2) {
      // EKOYILDIZ: GUILD2_TICKET_CATEGORY_ID kategorisine aç
      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: GUILD2_TICKET_CATEGORY_ID || undefined,
        permissionOverwrites: validOverwrites,
      });
    } else if (isAllied) {
      // Müttefik Sunucusu: DESTEK TALEPLERİ kategorisine aç
      let ticketCategory = targetGuild.channels.cache.find(
        (c) => c.name.toLowerCase() === "destek talepleri" && c.type === ChannelType.GuildCategory
      );
      if (!ticketCategory) {
        ticketCategory = await targetGuild.channels.create({
          name: "DESTEK TALEPLERİ",
          type: ChannelType.GuildCategory,
        });
      }
      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: validOverwrites,
      });
    } else if (isTMT) {
      // TMT: DESTEK TALEPLERİ kategorisine aç
      let ticketCategory = targetGuild.channels.cache.find(
        (c) => c.name.toLowerCase() === "destek talepleri" && c.type === ChannelType.GuildCategory
      );
      if (!ticketCategory) {
        ticketCategory = await targetGuild.channels.create({
          name: "DESTEK TALEPLERİ",
          type: ChannelType.GuildCategory,
        });
      }
      ticketChannel = await targetGuild.channels.create({
        name: `ticket-${ticketId.toLowerCase()}`,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        permissionOverwrites: validOverwrites,
      });
    } else {
      // Ana sunucu: mevcut mantık
      const configuredChannel = TARGET_CHANNEL_ID
        ? await targetGuild.channels.fetch(TARGET_CHANNEL_ID).catch(() => null)
        : null;

      if (configuredChannel?.type === ChannelType.GuildCategory) {
        ticketChannel = await targetGuild.channels.create({
          name: `ticket-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: configuredChannel.id,
          permissionOverwrites: validOverwrites,
        });
      } else if (configuredChannel?.type === ChannelType.GuildText) {
        ticketChannel = await targetGuild.channels.create({
          name: `ticket-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: configuredChannel.parentId,
          permissionOverwrites: validOverwrites,
        });
      } else {
        let ticketCategory = targetGuild.channels.cache.find(
          (c) => c.name.toLowerCase() === "destek talepleri" && c.type === ChannelType.GuildCategory
        );
        if (!ticketCategory) {
          ticketCategory = await targetGuild.channels.create({
            name: "DESTEK TALEPLERİ",
            type: ChannelType.GuildCategory,
          });
        }
        ticketChannel = await targetGuild.channels.create({
          name: `ticket-${ticketId.toLowerCase()}`,
          type: ChannelType.GuildText,
          parent: ticketCategory.id,
          permissionOverwrites: validOverwrites,
        });
      }
    }

    const ticket = new Ticket({
      ticketId,
      userId: interaction.user.id,
      userName: interaction.user.username,
      category,
      subject,
      description,
      priority,
      channelId: ticketChannel.id,
      guildId: targetGuildId,
    });

    await ticket.save();

    const ticketEmbed = buildTicketEmbed(ticket);
    const closeButton = buildCloseButton(ticketId);
    await ticketChannel.send({ embeds: [ticketEmbed], components: [closeButton] });

    if (isGuild2) {
      const { startTicketClaimRouting } = require("../services/reklamTicketService");
      startTicketClaimRouting(ticket, targetGuild, interaction.client).catch(err => {
        console.error("[modalHandler] Claim routing failed:", err.message);
      });
    }

    // ── AI karşılama devre dışı ───────────────────────────────────────────
    // (Ticket AI kaldırıldı)

    const { logTicketCreated } = require("../services/ticketLog");
    logTicketCreated(ticket, {
      source: "Discord Destek Menüsü",
      ticketChannelId: ticketChannel.id,
      guildId: targetGuildId,
    });

    return interaction.reply({ content: `✅ Ticket oluşturuldu: ${ticketChannel}`, ephemeral: true });
  } catch (err) {
    console.error("Ticket oluşturma hatası:", err);
    return interaction.reply({ content: `❌ Hata: ${err.message}`, ephemeral: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket kapatma sebebi işleme
// ─────────────────────────────────────────────────────────────────────────────
async function handleCloseReasonModal(interaction) {
  const ticketId = interaction.customId.replace("close_reason_modal_", "");
  const reason = interaction.fields.getTextInputValue("close_reason");

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
  }

  if (ticket.status === "closed") {
    return interaction.reply({ content: "❌ Bu ticket zaten kapalı", ephemeral: true });
  }

  // Ticket'ı kapat
  ticket.status = "closed";
  ticket.closedAt = new Date();
  ticket.closeReason = reason;
  ticket.closedBy = interaction.user.id;
  ticket.closedByName = interaction.user.username;
  await ticket.save();

  try {
    const { addNotification } = require("../../utils/notification");
    await addNotification(ticket.userId, {
      title: "🔒 Ticket Kapatıldı",
      message: `\`${ticket.ticketId}\` numaralı ticket'ınız kapatıldı. Sebep: ${reason || 'Belirtilmedi'}`,
      icon: "🔒"
    });
  } catch (_) {}

  // AI durumunu temizle
  try {
    const { cleanupTicketAI } = require('../services/ticketAI');
    cleanupTicketAI(ticketId);
  } catch (_) {}

  // Personel istatistiği — ticket'ı üstlenen yetkili ise ona, yoksa kapatan yetkiliye kaydet
  try {
    const { recordTicketSolved } = require('../services/staffSystem');
    const targetUserIdForCredit = ticket.claimedBy || (ticket.category === 'reklam_destek' ? null : interaction.user.id);
    if (targetUserIdForCredit) {
      await recordTicketSolved(targetUserIdForCredit, interaction.client);
    }
  } catch (_) {}

  // Önce etkileşimi onayla
  await interaction.reply({ content: "✅ Ticket kapatılıyor...", ephemeral: true });

  // Clean up active claim routing and delete DM message if any
  try {
    const { activeTicketClaims, deleteActiveClaimDmMessage } = require("../services/reklamTicketService");
    await deleteActiveClaimDmMessage(ticket.ticketId);
    activeTicketClaims.delete(ticket.ticketId);
  } catch (_) {}

  const { GUILD2_ID } = require("../../config");
  const isGuild2 = ticket.guildId === GUILD2_ID;

  if (isGuild2) {
    try {
      ticket.status = "closed";
      ticket.closedAt = new Date();
      ticket.closeReason = reason;
      ticket.closedBy = interaction.user.id;
      ticket.closedByName = interaction.user.username;
      await ticket.save();

      const { archiveEkoYildizTicket } = require("../services/epostaTicketService");
      await archiveEkoYildizTicket(ticket, interaction, reason);

      const { logTicketClosed } = require("../services/ticketLog");
      logTicketClosed(ticket, {
        closedBy: interaction.user.id,
        closedByName: interaction.user.username,
        reason,
        source: "Discord Kapat Butonu (Arşiv)",
      });
    } catch (err) {
      console.error("[closeEkoTicket] Error:", err.message);
    }
    return null;
  }

  try {
    // Ticket'ın hangi sunucuda olduğunu belirle
    const guildId = ticket.guildId || TARGET_GUILD_ID;
    const guild = await interaction.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

    // 1) Kanal mesajlarını log kanalına gönder
    const { logTicketClosed, logTicketMessages } = require("../services/ticketLog");

    if (channel) {
      await logTicketMessages(channel, ticket);
    }

    // 2) Ticket kapanma kaydını log kanalına gönder
    logTicketClosed(ticket, {
      closedBy: interaction.user.id,
      closedByName: interaction.user.username,
      reason,
      source: "Discord Kapat Butonu",
    });

    // 3) Ticket sahibine DM gönder
    try {
      const ticketOwner = await interaction.client.users.fetch(ticket.userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle("🔒 Ticket'ınız Kapatıldı")
        .setDescription(
          `Ticket'ınız **${interaction.user.username}** adlı kişi tarafından kapatıldı.\n\n` +
            `**Sebep:** ${reason}\n\n` +
            `Ticket'ı yeniden açmak veya destek ekibini değerlendirmek için aşağıdaki butonları kullanabilirsiniz.`
        )
        .addFields(
          { name: "🎫 Ticket ID", value: `\`${ticket.ticketId}\``, inline: true },
          { name: "📋 Konu", value: ticket.subject, inline: true }
        )
        .setFooter({ text: "Sentara Support • Gizlilik politikamız gereği değerlendirme notunuz anonim tutulur." })
        .setTimestamp();

      const dmButtons = buildReopenAndRateRow(ticketId);
      await ticketOwner.send({ embeds: [dmEmbed], components: [dmButtons] });
    } catch (dmErr) {
      console.warn("[closeTicket] Kullanıcıya DM gönderilemedi:", dmErr.message);
    }

    // 4) Kanalı kapat (izinleri kaldır ve kapatıldı mesajı gönder)
    if (channel) {
      const closeEmbed = new EmbedBuilder()
        .setTitle("🔒 Ticket Kapatıldı")
        .setDescription(
          `**Kapatan:** ${interaction.user.username}\n**Sebep:** ${reason}\n\n` +
          `⏳ Bu kanal **5 dakika** içinde yeniden açılmazsa otomatik silinecektir.`
        )
        .setColor(0xed4245)
        .setTimestamp();

      await channel.send({ embeds: [closeEmbed] });
      await channel.permissionOverwrites.edit(ticket.userId, {
        ViewChannel: false,
        SendMessages: false,
      });
    }

    // 5) 5 dakika sonra kanal silinmek üzere kuyruğa al
    const { scheduleTicketDeletion } = require("../services/ticketCleanup");
    scheduleTicketDeletion(ticket.ticketId);

  } catch (err) {
    console.error("[closeTicket] Hata:", err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Değerlendirme modal'ı işleme
// ─────────────────────────────────────────────────────────────────────────────
async function handleRatingModal(interaction) {
  const ticketId = interaction.customId.replace("rating_modal_", "");
  const rawScore = interaction.fields.getTextInputValue("rating_score").trim();
  const note = interaction.fields.getTextInputValue("rating_note").trim() || null;

  const score = parseInt(rawScore, 10);
  if (isNaN(score) || score < 1 || score > 5) {
    return interaction.reply({
      content: "❌ Geçersiz puan. Lütfen 1 ile 5 arasında bir sayı girin.",
      ephemeral: true,
    });
  }

  const ticket = await Ticket.findOne({ ticketId });
  if (!ticket) {
    return interaction.reply({ content: "❌ Ticket bulunamadı", ephemeral: true });
  }

  if (ticket.userId !== interaction.user.id) {
    return interaction.reply({ content: "❌ Bu ticket size ait değil", ephemeral: true });
  }

  if (ticket.rated) {
    return interaction.reply({ content: "❌ Bu ticket'ı zaten değerlendirdiniz", ephemeral: true });
  }

  // Değerlendirmeyi kaydet
  ticket.rated = true;
  ticket.ratingScore = score;
  ticket.ratingNote = note;
  await ticket.save();

  // Ticket'ı üstlenen kişiye DM gönder + bakiye ver
  const staffId = ticket.claimedBy || ticket.closedBy;
  if (staffId) {
    // ── Bakiye ödülü: puan × 100 coin ──────────────────────────────────────
    try {
      const Economy = require("../../models/Economy");
      const { saveStoreNow } = require("../../models/Store");
      const COIN_PER_STAR = 100;
      const earned = score * COIN_PER_STAR;

      let eco = await Economy.findOne({ userId: staffId });
      if (!eco) {
        eco = new Economy({ userId: staffId });
      }
      eco.balance = (eco.balance || 0) + earned;
      eco.totalEarned = (eco.totalEarned || 0) + earned;
      await eco.save();
      saveStoreNow();
      console.log(`[rating] ${staffId} → +${earned} coin (${score} yıldız)`);

      try {
        const { addNotification } = require("../../utils/notification");
        await addNotification(staffId, {
          title: "⭐ Yeni Puan ve Ödül",
          message: `\`${ticket.ticketId}\` numaralı ticket için ${score} yıldız aldınız ve coin ödülünüz eklendi.`,
          icon: "⭐"
        });
      } catch (_) {}
    } catch (ecoErr) {
      console.warn("[rating] Bakiye eklenemedi:", ecoErr.message);
    }

    try {
      const staffUser = await interaction.client.users.fetch(staffId);
      const stars = "⭐".repeat(score) + "☆".repeat(5 - score);
      const earned = score * 100;

      const ratingEmbed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("⭐ Yeni Bir Değerlendirme Aldınız!")
        .setDescription(
          `**Ticket:** \`${ticket.ticketId}\`\n` +
            `**Konu:** ${ticket.subject}\n\n` +
            `**Puan:** ${stars} (${score}/5)\n` +
            `**Kazanılan:** 💰 +${earned} coin\n` +
            (note ? `**Değerlendirme Notu:** ${note}` : "")
        )
        .setFooter({
          text: "Sentara Support • Gizlilik politikamız gereği puan veren kişinin adı paylaşılmaz.",
        })
        .setTimestamp();

      await staffUser.send({ embeds: [ratingEmbed] });
    } catch (dmErr) {
      console.warn("[ratingModal] Personele DM gönderilemedi:", dmErr.message);
    }
  }

  // Kullanıcıya onay
  const stars = "⭐".repeat(score) + "☆".repeat(5 - score);
  return interaction.reply({
    content: `✅ Değerlendirmeniz alındı! ${stars} (${score}/5)\nTeşekkür ederiz.`,
    ephemeral: true,
  });
}

module.exports = { handleModalSubmit };
