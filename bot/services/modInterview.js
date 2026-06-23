'use strict';

/**
 * Moderatör Başvuru Mülakatı Servisi (İyileştirilmiş Sürüm)
 * 
 * Özellikler:
 * - Yönetici → /mod-alim @kullanıcı (BBU sistemine entegre)
 * - Profesyonel arayüz dengan progress bar
 * - 7 adet zor mülakat sorusu
 * - Detaylı değerlendirme sistemi
 * - Ayrıntılı puan alma sistemi
 * - Kullanıcı, yönetici ve mod-ekibi bilgilendirmesi
 */

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { chatWithAI }   = require('./aiService');
const StaffProgress    = require('../../models/StaffProgress');

const MOD_ROLE_ID   = process.env.MOD_ROLE_ID   || '1518692389169135666'; // Moderatör Ekibi (veya başka bir ID)
const MOD_GUILD_ID  = process.env.MOD_GUILD_ID  || '1367646464804655104'; // EkoYıldız

// Aktif mülakatlar: userId → { adminId, guildId, history[], score, questionCount, startTime, responses[] }
const activeInterviews = new Map();

// ── Sorular için AI sistem promptu ────────────────────────────────────────
const INTERVIEW_SYSTEM = `Sen Eko Yıldız Discord sunucusu için MASTER MODERATÖR mülakatı yapan bir yapay zekasın.
Bu, en zor ve en seçici mülakat. Adaya 7 adet ÇOK ZOR, ANALITIK, GERÇEK DURUM sorusu sor.

SORULAR KATEGORİLERİ:
1. KURAL İHLALİ SENARYOSU (spam, taciz, küfür, NSFW detection)
2. ÇATIŞMA YÖNETİMİ (2+ kullanıcı tartışması, nasıl müdahale edersin?)
3. YETKİ SINIRLARI (ban vs warn, ne zaman kullanılır?)
4. EKIP İLETİŞİMİ VE ŞEFFAFLıK (hassas kararları nasıl yönetirsin?)
5. SUNUCU GÜVENLİĞİ (bot spam, alts, trust level)
6. TOPLULUK YÖNETİMİ (büyüme, sosyal dinamik, mod burnout)
7. ZORLUK DEĞERLENDİRMESİ (bu rolün gerçek zorlukları ve sorumluluğu)

HER CEVAP DEĞERLENDİRMESİ (zorunlu format):
[PUAN: X/10] Kısa ancak DEĞERLENDİRME (neden bu puan? eksikleri?)

CEVAP SONUCU ÖNCESİ:
• Eğer soru sayısı < 7: Sonraki soruyu sor
• Eğer soru sayısı = 7: SONUÇ VER

SONUÇ (zorunlu format):
[SONUÇ: KABUL] (Ortalama >= 7) veya [SONUÇ: RET] (Ortalama < 7)

SONUÇ AÇIKLAMASI:
- Adayın modlar arası POTANSIYEL'ini değerlendir
- 3-5 satır özet ve gelişim önerileri
- Başarısızlık durumunda: hangi alanlarda çalışması gerektiğini söyle

SES:
- Profesyonel, adil, destekleyici
- Türkçe, net ve anlaşılır
- Her soru MAX 250 karakter`;

// ── Başvuru başlat ─────────────────────────────────────────────────────────
async function startModInterview(targetUser, adminId, guildId, client) {
  // Kullanıcıya DM'de teklif gönder
  const embed = new EmbedBuilder()
    .setColor(0x7c6af7)
    .setTitle('🛡️ MOD-ALIM: Moderatör Başvurusu')
    .setThumbnail(targetUser.avatarURL() || null)
    .setDescription(
      `Merhaba **${targetUser.username}**! 👋\n\n` +
      `**Eko Yıldız** sunucusunda **MASTER MODERATÖR** olmak için ÖZEL MÜLAKATa davet edildin!\n\n` +
      `🎯 **Bu ne?**\n` +
      `• **7 çok zor mülakat sorusu** (Gerçek moderatörlük senaryoları)\n` +
      `• **Detaylı AI değerlendirmesi** (Her cevap puanlanır)\n` +
      `• **Başarılı olursan:**\n` +
      `  └─ 🛡️ Moderatör Ekibi rolü\n` +
      `  └─ 📊 Staff Sistemine kaydolma\n` +
      `  └─ 🎖️ Özel moderatör rozetleri\n\n` +
      `📋 **Beklentiler:**\n` +
      `• Moderatörlük bilgisi ve deneyim\n` +
      `• Discord güvenliği anlayışı\n` +
      `• Ekip iletişim ve liderlik kapasitesi\n` +
      `• Topluluk yönetim vizyon\n\n` +
      `Bu mülakat zor olacak. Girmek ister misin?`
    )
    .setFooter({ text: 'Eko Yıldız • Moderatör Seçimi Sistemi' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mod_interview_yes_${targetUser.id}`)
      .setLabel('✅ Evet, Katılıyorum')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mod_interview_no_${targetUser.id}`)
      .setLabel('❌ İstiyorum Ama Zamanım Yok')
      .setStyle(ButtonStyle.Secondary)
  );

  try {
    await targetUser.send({ embeds: [embed], components: [row] });
    activeInterviews.set(targetUser.id, {
      adminId,
      guildId,
      history: [],
      score: 0,
      questionCount: 0,
      totalScore: 0,
      client,
      startTime: Date.now(),
      responses: [],
      username: targetUser.username,
    });
    return true;
  } catch (err) {
    console.error('[modInterview] DM gönderilemedi:', err.message);
    return false;
  }
}

// ── Evet/Hayır buton handler ───────────────────────────────────────────────
async function handleInterviewButton(interaction, client) {
  const cid = interaction.customId;
  if (!cid.startsWith('mod_interview_yes_') && !cid.startsWith('mod_interview_no_')) return false;

  const userId = interaction.user.id;

  if (cid.startsWith('mod_interview_no_')) {
    const info = activeInterviews.get(userId);
    activeInterviews.delete(userId);
    
    await interaction.update({
      content: '⏸️ Tamam, anladım! Hazır olduğunda tekrar başvurabilirsin. İyi şanslar!',
      embeds: [], components: [],
    }).catch(() => {});

    // Admini bilgilendir
    if (info) {
      try {
        const admin = await client.users.fetch(info.adminId);
        await admin.send({
          embeds: [new EmbedBuilder()
            .setColor(0xfbbf24)
            .setTitle('⏸️ Mülakat Ertelendi')
            .setDescription(`**${interaction.user.tag}** moderatör mülakatını erteledi.\n\nİlerde tekrar başvurabilir.`)
            .setTimestamp()]
        });
      } catch (_) {}
    }
    return true;
  }

  // Evet — mülakatı başlat
  const info = activeInterviews.get(userId);
  if (!info) {
    await interaction.update({ content: '❌ Başvuru bulunamadı.', embeds: [], components: [] }).catch(() => {});
    return true;
  }

  await interaction.update({
    content: '🚀 **Harika!** Mülakat başlıyor... DM'den sorular gelecek.',
    embeds: [new EmbedBuilder()
      .setColor(0x7c6af7)
      .setDescription('⏳ Lütfen DM'ni kontrol et!\n*Sorulara cevap vermek için yazılı olarak yanıt verebilirsin.*')], 
    components: [],
  }).catch(() => {});

  // İlk soruyu sor
  try {
    await askNextQuestion(userId, null, client);
  } catch (err) {
    console.error('[modInterview] İlk soru hatası:', err.message);
    await interaction.user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ Mülakat Başlatılamadı')
        .setDescription(`Teknik bir hata oluştu: \`${err.message}\`\n\nLütfen daha sonra tekrar dene.`)
        .setFooter({ text: 'Eko Yıldız • Moderatör Seçimi' })]
    }).catch(() => {});
    activeInterviews.delete(userId);
  }

  return true;
}

// ── Sonraki soruyu sor ─────────────────────────────────────────────────────
async function askNextQuestion(userId, previousAnswer, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;

  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) return;

  if (previousAnswer) {
    info.history.push({ role: 'user', content: previousAnswer });
    info.responses.push(previousAnswer);
  }

  try {
    const dmCh = await user.createDM().catch(() => null);
    if (dmCh) await dmCh.sendTyping().catch(() => {});

    let systemMsg = '';
    if (info.questionCount === 0) {
      systemMsg = 'Mülakatı başlat. İlk soruyu sor.';
    } else if (info.questionCount >= 7) {
      systemMsg = 'Tüm 7 soru tamamlandı. Sonuç değerlendir: [SONUÇ: KABUL] veya [SONUÇ: RET]. Genel özet yap.';
    } else {
      systemMsg = `${info.questionCount}. soruyu değerlendir ve ${info.questionCount + 1}. soruyu sor.`;
    }

    info.history.push({ role: 'user', content: systemMsg });
    const reply = await chatWithAI(info.history, INTERVIEW_SYSTEM);
    info.history.push({ role: 'assistant', content: reply });
    info.questionCount++;

    // Puan hesapla
    const scoreMatch = reply.match(/\[PUAN:\s*(\d+)\/10\]/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      info.totalScore += score;
      info.score = score;
    }

    // Sonuç var mı?
    if (/\[SONUÇ:\s*KABUL\]/i.test(reply)) {
      await finalizeInterview(userId, true, reply, client);
      return;
    }
    if (/\[SONUÇ:\s*RET\]/i.test(reply)) {
      await finalizeInterview(userId, false, reply, client);
      return;
    }

    // Progress bar oluştur
    const progress = Math.min(info.questionCount, 7);
    const progressBar = '█'.repeat(progress) + '░'.repeat(7 - progress);

    // Soru gönder
    const cleanReply = reply
      .replace(/\[PUAN:[^\]]+\]/gi, '')
      .replace(/\[SONUÇ:[^\]]+\]/gi, '')
      .trim();

    await user.send({
      embeds: [new EmbedBuilder()
        .setColor(0x7c6af7)
        .setAuthor({ name: `🛡️ MOD-ALIM MÜLAKATı • Soru ${progress}/7` })
        .setDescription(cleanReply)
        .addFields(
          { name: '📊 İlerleme', value: `\`${progressBar}\` ${progress}/7`, inline: false }
        )
        .setFooter({ text: 'Cevabını yazarak gönder. DM bağlantısını açık tut.' })
        .setTimestamp()],
    });
  } catch (err) {
    console.error('[modInterview] Soru hatası:', err.message);
    await user.send({
      embeds: [new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle('⚠️ Geçici Sorun')
        .setDescription(`AI geçici olarak yanıt veremiyor.\n\nBirazdan tekrar deniyor...\n\n\`\`\`${err.message}\`\`\``)]
    });
  }
}

// ── DM'den cevap gelince ───────────────────────────────────────────────────
async function handleInterviewReply(message, client) {
  const userId = message.author.id;
  if (!activeInterviews.has(userId)) return false;
  if (activeInterviews.get(userId).questionCount === 0) return false; // Henüz başlamadı

  await askNextQuestion(userId, message.content, client);
  return true;
}

// ── Mülakat sonuçlandır ────────────────────────────────────────────────────
async function finalizeInterview(userId, accepted, summary, client) {
  const info = activeInterviews.get(userId);
  if (!info) return;
  activeInterviews.delete(userId);

  const user = await client.users.fetch(userId).catch(() => null);
  const avgScore = info.questionCount > 0 ? Math.round(info.totalScore / Math.min(info.questionCount, 7)) : 0;
  const duration = Math.round((Date.now() - info.startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const cleanSummary = summary
    .replace(/\[SONUÇ:[^\]]+\]/gi, '')
    .replace(/\[PUAN:[^\]]+\]/gi, '')
    .trim()
    .slice(0, 1024);

  if (accepted) {
    // Rol ver
    try {
      const guild  = await client.guilds.fetch(info.guildId).catch(() => null);
      const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
      if (member) {
        await member.roles.add(MOD_ROLE_ID, 'Moderatör mülakatını geçti (MOD-ALIM)').catch(() => {});
      }
    } catch (err) {
      console.warn('[modInterview] Rol verilemedi:', err.message);
    }

    // Staff sistemine kayıt et — Stajyer Personel olarak başlat
    try {
      let p = await StaffProgress.findOne({ userId });
      if (!p) {
        p = new StaffProgress({ userId, guildId: info.guildId, level: 1 });
      } else if (p.level < 1) {
        p.level = 1;
      }
      await p.save();
      console.log(`[modInterview] ${userId} → staff sisteme kaydedildi (MASTER MOD)`);
    } catch (err) {
      console.warn('[modInterview] Staff kayıt hatası:', err.message);
    }

    // Kullanıcıya tebrik et
    if (user) {
      const acceptionEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('🎉 TEBRİKLER! MASTER MODERATÖR OLDUNUZ!')
        .setThumbnail(user.avatarURL() || null)
        .setDescription(
          `Mülakatı **başarıyla geçtiniz**! 🏆\n\n` +
          `Eko Yıldız moderasyon ekibine hoş geldiniz.`
        )
        .addFields(
          { name: '📊 Mülakat Sonuçları', value: `Ortalama Puan: **${avgScore}/10**\nSüre: **${minutes}m ${seconds}s**`, inline: false },
          { name: '✨ Değerlendirme', value: cleanSummary, inline: false },
          { name: '🎁 Sahip Olduğunuz', value: '• 🛡️ Moderatör Ekibi Rolü\n• 📊 Staff Sistem Kaydı\n• 🎖️ Moderator Rozetleri', inline: false }
        )
        .setFooter({ text: 'Eko Yıldız • MOD-ALIM Sistemi' })
        .setTimestamp();

      await user.send({ embeds: [acceptionEmbed] }).catch(() => {});
    }

    // Yöneticiye ve mod ekibine bildir
    try {
      const admin = await client.users.fetch(info.adminId);
      const adminEmbed = new EmbedBuilder()
        .setColor(0x4ade80)
        .setTitle('✅ MÜLAKAT SONUCU: KABUL')
        .setThumbnail(user?.avatarURL() || null)
        .setDescription(
          `**Aday:** ${user?.tag || `<@${userId}>`}\n` +
          `**Yönetici:** <@${info.adminId}>\n` +
          `**Sunucu:** <@&${MOD_ROLE_ID}>`
        )
        .addFields(
          { name: '📊 Sonuçlar', value: `**Ortalama Puan:** ${avgScore}/10\n**Toplam Soru:** ${Math.min(info.questionCount, 7)}/7\n**Süre:** ${minutes}m ${seconds}s`, inline: false },
          { name: '💬 Değerlendirme', value: cleanSummary, inline: false }
        )
        .setFooter({ text: 'Sistem Tarihi: ' + new Date().toLocaleString('tr-TR') })
        .setTimestamp();

      await admin.send({ embeds: [adminEmbed] });
    } catch (_) {}
  } else {
    // Reddedildi
    if (user) {
      const rejectionEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ MÜLAKAT SONUCU: RED')
        .setThumbnail(user.avatarURL() || null)
        .setDescription(
          `Bu sefer moderatör kriterlerini karşılayamadınız.\n\n` +
          `Ancak bu son değil! Kendini geliştirerek tekrar başvurabilirsin.`
        )
        .addFields(
          { name: '📊 Sonuçlar', value: `Ortalama Puan: **${avgScore}/10**\nSürü: **${minutes}m ${seconds}s**`, inline: false },
          { name: '💬 Geri Bildirim', value: cleanSummary, inline: false },
          { name: '💡 Sonraki Adımlar', value: 'Değerlendirlmede belirtilen alanlara odaklanarak kendini geliştir. Sonra tekrar başvurup başarı sağlayabilirsin! 💪', inline: false }
        )
        .setFooter({ text: 'Eko Yıldız • MOD-ALIM Sistemi' })
        .setTimestamp();

      await user.send({ embeds: [rejectionEmbed] }).catch(() => {});
    }

    // Yöneticiye bildir
    try {
      const admin = await client.users.fetch(info.adminId);
      const adminEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle('❌ MÜLAKAT SONUCU: RET')
        .setThumbnail(user?.avatarURL() || null)
        .setDescription(
          `**Aday:** ${user?.tag || `<@${userId}>`}\n` +
          `**Yönetici:** <@${info.adminId}>`
        )
        .addFields(
          { name: '📊 Sonuçlar', value: `**Ortalama Puan:** ${avgScore}/10\n**Toplam Soru:** ${Math.min(info.questionCount, 7)}/7\n**Süre:** ${minutes}m ${seconds}s`, inline: false },
          { name: '💬 Değerlendirme', value: cleanSummary, inline: false }
        )
        .setFooter({ text: 'Sistem Tarihi: ' + new Date().toLocaleString('tr-TR') })
        .setTimestamp();

      await admin.send({ embeds: [adminEmbed] });
    } catch (_) {}
  }
}

module.exports = {
  startModInterview,
  handleInterviewButton,
  handleInterviewReply,
};
