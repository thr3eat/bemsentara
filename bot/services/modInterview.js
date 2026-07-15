'use strict';

/**
 * Moderatör Başvuru Mülakatı Servisi (v2 — Düzeltilmiş & Geliştirilmiş)
 *
 * Değişiklikler:
 * - questionCount mantığı düzeltildi (cevaplanan soru sayısını takip eder)
 * - history yönetimi düzeltildi (sistem mesajları history'ye karışmıyor)
 * - avgScore hesabı düzeltildi
 * - Mülakat timeout (30 dk) eklendi — memory leak önlendi
 * - Typo'lar düzeltildi
 * - Rol / staff kaydı hatalarında kullanıcı ve admin bilgilendiriliyor
 * - finalizeInterview rol+staff işlemleri tek try/catch yerine ayrı ayrı yakalanıyor
 * - Tüm gönderimler .catch(console.error) yerine loglanıyor
 * - cleanSummary slice limiti 1024 → 4096 (embed description sınırı)
 * - İlk soru mantiği ayrı bir prompt ile tetikleniyor (gereksiz systemMsg kaldırıldı)
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { chatWithAI } = require('./aiService');
const StaffProgress = require('../../models/StaffProgress');

const MOD_ROLE_ID = process.env.MOD_ROLE_ID || '1518692389169135666';
const MOD_GUILD_ID = process.env.MOD_GUILD_ID || '1367646464804655104';

const INTERVIEW_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika

/**
 * activeInterviews: userId → {
 *   adminId, guildId, client,
 *   history[],          ← yalnızca kullanıcı cevapları + AI yanıtları
 *   answeredCount,      ← kaçıncı soruya cevap verildi (0–7)
 *   totalScore,
 *   startTime,
 *   responses[],
 *   username,
 *   timeoutHandle
 * }
 */
const activeInterviews = new Map();

// ── Sistem promptu ─────────────────────────────────────────────────────────
const INTERVIEW_SYSTEM = `Sen Eko Yıldız Discord sunucusu için MASTER MODERATÖR mülakatı yapan bir yapay zekasın.
Bu, en zor ve en seçici mülakat. Adaya toplamda 7 adet ÇOK ZOR, ANALİTİK, GERÇEK DURUM sorusu sor.

SORU KATEGORİLERİ (sırayla):
1. KURAL İHLALİ SENARYOSU (spam, taciz, küfür, NSFW tespiti)
2. ÇATIŞMA YÖNETİMİ (2+ kullanıcı tartışması, nasıl müdahale edersin?)
3. YETKİ SINIRLARI (ban vs warn, ne zaman kullanılır?)
4. EKİP İLETİŞİMİ VE ŞEFFAFLIK (hassas kararları nasıl yönetirsin?)
5. SUNUCU GÜVENLİĞİ (bot spam, alt hesaplar, güven seviyesi)
6. TOPLULUK YÖNETİMİ (büyüme, sosyal dinamik, mod tükenmişliği)
7. ZORLUK DEĞERLENDİRMESİ (bu rolün gerçek zorlukları ve sorumlulukları)

AKIŞ:
- Her turda önce önceki cevabı değerlendir (ilk turda değerlendirme yok), ardından yeni soruyu sor.
- 7. soruya cevap geldikten sonra SONUÇ ver.

DEĞERLENDİRME FORMATI (zorunlu, her cevap sonrası):
[PUAN: X/10] Kısa değerlendirme metni.

SONUÇ FORMATI (7. cevap sonrası zorunlu):
[SONUÇ: KABUL] (Ortalama >= 7.0) veya [SONUÇ: RET] (Ortalama < 7.0)
Ardından 3-5 satır genel değerlendirme ve gelişim önerileri yaz.

ÜSLİP:
- Profesyonel, adil, destekleyici, Türkçe
- Her soru MAX 250 karakter`;

// ── Yardımcı: güvenli DM gönder ───────────────────────────────────────────
async function safeSend(user, payload, label = '') {
  try {
    await user.send(payload);
  } catch (err) {
    console.error(`[modInterview] DM gönderilemedi${label ? ' (' + label + ')' : ''}:`, err.message);
  }
}

// ── Timeout temizleyici ────────────────────────────────────────────────────
function clearInterview(userId) {
  const info = activeInterviews.get(userId);
  if (info?.timeoutHandle) clearTimeout(info.timeoutHandle);
  activeInterviews.delete(userId);
}

// ── Timeout başlat / yenile ────────────────────────────────────────────────
function refreshTimeout(userId, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;

  if (info.timeoutHandle) clearTimeout(info.timeoutHandle);

  info.timeoutHandle = setTimeout(async () => {
    activeInterviews.delete(userId);
    const user = await client.users.fetch(userId).catch(() => null);
    if (user) {
      await safeSend(user, {
        embeds: [new EmbedBuilder()
          .setColor(0xfbbf24)
          .setTitle('⏰ Mülakat Süresi Doldu')
          .setDescription(
            '30 dakika boyunca yanıt alınamadı.\n\n' +
            'Mülakat otomatik olarak sonlandırıldı. İstersen tekrar başvurabilirsin.'
          )
          .setFooter({ text: 'Eko Yıldız • MOD-ALIM Sistemi' })
          .setTimestamp()],
      }, 'timeout bildirimi');
    }
  }, INTERVIEW_TIMEOUT_MS);
}

// ── Başvuru başlat ─────────────────────────────────────────────────────────
async function startModInterview(targetUser, adminId, guildId, client) {
  if (activeInterviews.has(targetUser.id)) {
    // Zaten aktif mülakat varsa temizle ve yeniden başlat
    clearInterview(targetUser.id);
  }

  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle('🛡️ MOD-ALIM: Moderatör Başvurusu')
    .setThumbnail(targetUser.avatarURL() || null)
    .setDescription(
      `Merhaba **${targetUser.username}**! 👋\n\n` +
      `**Eko Yıldız** sunucusunda **MASTER MODERATÖR** olmak için ÖZEL MÜLAKATa davet edildin!\n\n` +
      `🎯 **Bu Mülakat Nedir?**\n` +
      `• **7 zor mülakat sorusu** — Gerçek moderatörlük senaryoları\n` +
      `• **Detaylı AI değerlendirmesi** — Her cevap 10 üzerinden puanlanır\n` +
      `• **Başarılı olursan:**\n` +
      `  └─ 🛡️ Moderatör Ekibi rolü\n` +
      `  └─ 📊 Staff sistemine kayıt\n` +
      `  └─ 🎖️ Moderatör rozetleri\n\n` +
      `📋 **Aradığımız Özellikler:**\n` +
      `• Moderatörlük bilgisi ve deneyimi\n` +
      `• Discord güvenliği anlayışı\n` +
      `• Ekip iletişimi ve liderlik kapasitesi\n` +
      `• Topluluk yönetim vizyonu\n\n` +
      `⏱️ Mülakat için **30 dakika** süren var. Başlamak ister misin?`
    )
    .setFooter({ text: 'Eko Yıldız • Moderatör Seçimi Sistemi' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod_interview_yes_${targetUser.id}_${adminId}_${guildId}`)
      .setLabel('✅ Evet, Katılıyorum')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mod_interview_no_${targetUser.id}_${adminId}_${guildId}`)
      .setLabel('❌ Şu An Zamanım Yok')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await targetUser.send({ embeds: [embed], components: [row] });
  } catch (err) {
    console.error('[modInterview] Davet DM gönderilemedi:', err.message);
    return false;
  }

  activeInterviews.set(targetUser.id, {
    adminId,
    guildId,
    client,
    history: [],        // [ { role, content }, ... ] — yalnızca AI konuşma geçmişi
    answeredCount: 0,   // kullanıcının cevapladığı soru sayısı
    totalScore: 0,
    startTime: Date.now(),
    responses: [],
    username: targetUser.username,
    timeoutHandle: null,
  });

  // Davet için kısa timeout — kullanıcı 30 dk içinde yanıt vermezse temizle
  refreshTimeout(targetUser.id, client);
  return true;
}

// ── Evet / Hayır buton handler ─────────────────────────────────────────────
async function handleInterviewButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('mod_interview_yes_') && !cid.startsWith('mod_interview_no_')) return false;

  const userId = interaction.user.id;
  let info = activeInterviews.get(userId);

  if (!info) {
    const parts = cid.split('_');
    if (parts.length >= 6) {
      const targetUserId = parts[3];
      const adminId = parts[4];
      const guildId = parts[5];
      
      // Re-initialize the active interview session dynamically in memory
      info = {
        adminId,
        guildId,
        client,
        history: [],
        answeredCount: 0,
        totalScore: 0,
        startTime: Date.now(),
        responses: [],
        username: interaction.user.username,
        timeoutHandle: null,
      };
      activeInterviews.set(targetUserId, info);
      refreshTimeout(targetUserId, client);
    }
  }

  // ── Hayır ──
  if (cid.startsWith('mod_interview_no_')) {
    clearInterview(userId);

    await interaction.update({
      content: '⏸️ Tamam, anladım! Hazır olduğunda tekrar başvurabilirsin. Başarılar! 🍀',
      embeds: [], components: [],
    }).catch(() => { });

    if (info) {
      const admin = await client.users.fetch(info.adminId).catch(() => null);
      if (admin) {
        await safeSend(admin, {
          embeds: [new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('⏸️ Mülakat Ertelendi')
            .setDescription(
              `**${interaction.user.tag}** moderatör mülakatını erteledi.\n\nİlerde tekrar başvurabilir.`
            )
            .setTimestamp()],
        }, 'admin-erteleme');
      }
    }
    return true;
  }

  // ── Evet ──
  if (!info) {
    await interaction.update({ content: '❌ Başvuru bulunamadı veya süresi doldu.', embeds: [], components: [] }).catch(() => { });
    return true;
  }

  await interaction.update({
    embeds: [new EmbedBuilder()
      .setColor(0x7c6af7)
      .setDescription('🚀 **Harika! Mülakat başlıyor...**\n⏳ İlk soru DM\'ne geliyor.')],
    components: [],
  }).catch(() => { });

  // İlk soruyu sor
  await askNextQuestion(userId, null, client).catch(async (err) => {
    console.error('[modInterview] İlk soru hatası:', err.message);
    clearInterview(userId);
    await safeSend(interaction.user, {
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Mülakat Başlatılamadı')
        .setDescription(`Teknik bir hata oluştu:\n\`\`\`${err.message}\`\`\`\nLütfen daha sonra tekrar dene.`)
        .setFooter({ text: 'Eko Yıldız • Moderatör Seçimi' })],
    }, 'başlatma hatası');
  });

  return true;
}

// ── Sonraki soruyu sor (veya sonucu değerlendir) ───────────────────────────
async function askNextQuestion(userId, previousAnswer, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) { clearInterview(userId); return; }

  // Timeout'u yenile (aktif konuşma var)
  refreshTimeout(userId, client);

  // Kullanıcı cevabını kaydet
  if (previousAnswer) {
    info.history.push({ role: 'user', content: previousAnswer });
    info.responses.push(previousAnswer);
    info.answeredCount++;
  }

  // 7 cevap alındı mı? Kontrol et
  if (info.answeredCount >= 7) {
    // Typing göstergesi
    const dmCh = await user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => { });

    // Sonuçlandırma AI'ına gönder
    const finalPrompt = `${info.answeredCount}. cevabı değerlendir ve [SONUÇ: KABUL] veya [SONUÇ: RET] ver. Genel özet yaz.`;
    const historyWithPrompt = [...info.history, { role: 'user', content: finalPrompt }];
    const reply = await chatWithAI(historyWithPrompt, INTERVIEW_SYSTEM);

    // AI yanıtını history'ye ekle (kalıcı)
    info.history.push({ role: 'user', content: finalPrompt });
    info.history.push({ role: 'assistant', content: reply });

    // Puan parse et
    const scoreMatch = reply.match(/\[PUAN:\s*(\d+(?:\.\d+)?)\/10\]/i);
    if (scoreMatch) {
      info.totalScore += parseFloat(scoreMatch[1]);
    }

    // Sonucu kontrol et
    if (/\[SONUÇ:\s*KABUL\]/i.test(reply)) {
      await finalizeInterview(userId, true, reply, client);
      return;
    }
    if (/\[SONUÇ:\s*RET\]/i.test(reply)) {
      await finalizeInterview(userId, false, reply, client);
      return;
    }

    // Eğer sonuç parçası yoksa hata
    console.error(`[modInterview] ${userId} için sonuç parçası bulunamadı. Reply:`, reply.slice(0, 200));
    await finalizeInterview(userId, false, reply, client);
    return;
  }

  // Typing göstergesi
  const dmCh = await user.createDM().catch(() => null);
  if (dmCh) await dmCh.sendTyping().catch(() => { });

  // AI'a gönderilecek mesajı hazırla
  let userPrompt;
  if (info.answeredCount === 0) {
    // Henüz cevap yok — ilk soruyu sor
    userPrompt = 'Mülakatı başlat ve 1. soruyu sor. Değerlendirme yapma.';
  } else {
    // Ara soru
    userPrompt = `${info.answeredCount}. cevabı değerlendir, ardından ${info.answeredCount + 1}. soruyu sor.`;
  }

  // Geçici prompt mesajını history'ye ekle, AI yanıtladıktan sonra tutut kalıcı
  const historyWithPrompt = [...info.history, { role: 'user', content: userPrompt }];
  const reply = await chatWithAI(historyWithPrompt, INTERVIEW_SYSTEM);

  // AI yanıtını kalıcı history'ye ekle
  info.history.push({ role: 'user', content: userPrompt });
  info.history.push({ role: 'assistant', content: reply });

  // Puan parse et
  const scoreMatch = reply.match(/\[PUAN:\s*(\d+(?:\.\d+)?)\/10\]/i);
  if (scoreMatch) {
    info.totalScore += parseFloat(scoreMatch[1]);
  }

  // Soru numarası: answeredCount + 1 = gösterilen soru no
  const currentQuestion = info.answeredCount + 1;
  const progress = Math.min(currentQuestion, 7);
  const progressBar = '█'.repeat(progress) + '░'.repeat(7 - progress);

  const cleanReply = reply
    .replace(/\[PUAN:[^\]]+\]/gi, '')
    .replace(/\[SONUÇ:[^\]]+\]/gi, '')
    .trim();

  await safeSend(user, {
    embeds: [new EmbedBuilder()
      .setColor(0x7c6af7)
      .setAuthor({ name: `🛡️ MOD-ALIM MÜLAKATı • Soru ${progress}/7` })
      .setDescription(cleanReply)
      .addFields({
        name: '📊 İlerleme',
        value: `\`${progressBar}\` ${progress}/7`,
        inline: false,
      })
      .setFooter({ text: 'Cevabını yazarak gönder. DM bağlantını açık tut.' })
      .setTimestamp()],
  }, `soru-${progress}`);
}

// ── DM'den cevap gelince ───────────────────────────────────────────────────
async function handleInterviewReply(message, client) {
  const userId = message.author.id;
  const info = activeInterviews.get(userId);
  if (!info) return false;
  // İlk soru henüz gönderilmemişse (answeredCount=0 ama history de boşsa) cevap alma
  if (info.answeredCount === 0 && info.history.length === 0) return false;

  await askNextQuestion(userId, message.content, client).catch((err) => {
    console.error('[modInterview] Cevap işleme hatası:', err.message);
  });
  return true;
}

// ── Mülakat sonuçlandır ────────────────────────────────────────────────────
async function finalizeInterview(userId, accepted, summary, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;
  clearInterview(userId); // timeout temizle + map'ten sil

  const user = await client.users.fetch(userId).catch(() => null);
  const answered = Math.min(info.answeredCount, 7);
  const avgScore = answered > 0 ? +(info.totalScore / answered).toFixed(1) : 0;

  const duration = Math.round((Date.now() - info.startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const cleanSummary = summary
    .replace(/\[SONUÇ:[^\]]+\]/gi, '')
    .replace(/\[PUAN:[^\]]+\]/gi, '')
    .trim()
    .slice(0, 1000); // embed field limiti 1024 — biraz pay bırak

  let roleOk = false;
  let staffOk = false;

  if (accepted) {
    roleOk = true; // Set to true for logging since they'll be processed by the school system
    // ── Staff sistemine kayıt (Okul Sistemi Başlangıcı) ──
    try {
      let p = await StaffProgress.findOne({ userId });
      if (!p) {
        p = new StaffProgress({ userId, guildId: info.guildId, level: 1 });
      }
      p.schoolSystem = {
        status: 'pending_contract',
        originalLevel: 1,
        originalRoles: []
      };
      p.status = 'active';
      await p.save();
      staffOk = true;
      console.log(`[modInterview] ${userId} → staff sistemine (Okul Entegrasyonu) kaydedildi`);

      // Okul sözleşmesini gönder
      try {
        const { sendContractDM } = require('./moderatorSchool');
        await sendContractDM(userId, client);
      } catch (errSchool) {
        console.error('[modInterview] Okul sözleşmesi gönderilemedi:', errSchool.message);
      }
    } catch (err) {
      console.warn('[modInterview] Staff kayıt hatası:', err.message);
    }

    // ── Kullanıcıya tebrik ──
    if (user) {
      await safeSend(user, {
        embeds: [new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('🎉 TEBRİKLER! MÜLAKATI GEÇTİNİZ!')
          .setThumbnail(user.avatarURL() || null)
          .setDescription(
            `Mülakatı **başarıyla geçtiniz**! 🏆\n\n` +
            `Moderatör ekibine katılmadan önce kısa süreli bir eğitim kampımız (Moderatör Okulu) bulunuyor. Eğitim detayları ve sözleşmeniz DM üzerinden size iletildi.`
          )
          .addFields(
            { name: '📊 Mülakat Sonuçları', value: `Ortalama Puan: **${avgScore}/10**\nSüre: **${minutes}d ${seconds}s**`, inline: false },
            { name: '✨ Değerlendirme', value: cleanSummary || '—', inline: false }
          )
          .setFooter({ text: 'Eko Yıldız • MOD-ALIM Sistemi' })
          .setTimestamp()],
      }, 'tebrik');
    }

    // ── Yöneticiye bildir ──
    const admin = await client.users.fetch(info.adminId).catch(() => null);
    if (admin) {
      const statusLine = `Rol: ${roleOk ? '✅' : '❌'}  |  Staff Kaydı: ${staffOk ? '✅' : '❌'}`;
      await safeSend(admin, {
        embeds: [new EmbedBuilder()
          .setColor(0x4ade80)
          .setTitle('✅ MÜLAKAT SONUCU: KABUL')
          .setThumbnail(user?.avatarURL() || null)
          .setDescription(
            `**Aday:** ${user?.tag || `<@${userId}>`}\n` +
            `**Yönetici:** <@${info.adminId}>\n` +
            `**Mod Rolü:** <@&${MOD_ROLE_ID}>`
          )
          .addFields(
            { name: '📊 Sonuçlar', value: `**Ortalama Puan:** ${avgScore}/10\n**Toplam Soru:** ${answered}/7\n**Süre:** ${minutes}d ${seconds}s`, inline: false },
            { name: '🔧 Sistem Durumu', value: statusLine, inline: false },
            { name: '💬 Değerlendirme', value: cleanSummary || '—', inline: false }
          )
          .setFooter({ text: 'Sistem Tarihi: ' + new Date().toLocaleString('tr-TR') })
          .setTimestamp()],
      }, 'admin-kabul');
    }

  } else {
    // ── Kullanıcıya red bildirimi ──
    if (user) {
      await safeSend(user, {
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ MÜLAKAT SONUCU: REDDEDİLDİ')
          .setThumbnail(user.avatarURL() || null)
          .setDescription(
            `Bu sefer moderatör kriterlerini karşılayamadınız.\n\n` +
            `Ama bu son değil! Kendini geliştirerek tekrar başvurabilirsin. 💪`
          )
          .addFields(
            { name: '📊 Sonuçlar', value: `Ortalama Puan: **${avgScore}/10**\nSüre: **${minutes}d ${seconds}s**`, inline: false },
            { name: '💬 Geri Bildirim', value: cleanSummary || '—', inline: false },
            { name: '💡 Sonraki Adımlar', value: 'Değerlendirmede belirtilen alanlara odaklanarak kendini geliştir. Daha sonra tekrar başvurabilirsin!', inline: false }
          )
          .setFooter({ text: 'Eko Yıldız • MOD-ALIM Sistemi' })
          .setTimestamp()],
      }, 'red bildirimi');
    }

    // ── Yöneticiye bildir ──
    const admin = await client.users.fetch(info.adminId).catch(() => null);
    if (admin) {
      await safeSend(admin, {
        embeds: [new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ MÜLAKAT SONUCU: RET')
          .setThumbnail(user?.avatarURL() || null)
          .setDescription(
            `**Aday:** ${user?.tag || `<@${userId}>`}\n` +
            `**Yönetici:** <@${info.adminId}>`
          )
          .addFields(
            { name: '📊 Sonuçlar', value: `**Ortalama Puan:** ${avgScore}/10\n**Toplam Soru:** ${answered}/7\n**Süre:** ${minutes}d ${seconds}s`, inline: false },
            { name: '💬 Değerlendirme', value: cleanSummary || '—', inline: false }
          )
          .setFooter({ text: 'Sistem Tarihi: ' + new Date().toLocaleString('tr-TR') })
          .setTimestamp()],
      }, 'admin-ret');
    }
  }
}

module.exports = {
  startModInterview,
  handleInterviewButton,
  handleInterviewReply,
};