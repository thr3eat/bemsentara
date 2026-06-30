'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { chatWithAI } = require('./aiService');
const StaffUnit = require('../../models/StaffUnit');
const Coach = require('../../models/Coach');
const { shouldCoachReceiveMessage, sendMessageToCoach } = require('./coachMessageService');

const MAIN_GUILD_ID = '1367646464804655104';

// Birim konfigürasyonları
const UNIT_CONFIG = {
  BAN_BIRIMI: { label: 'BAN BİRİMİ', emoji: '🛡️' },
  SES_BIRIMI: { label: 'SES BİRİMİ', emoji: '🎤' },
  SOHBET_BIRIMI: { label: 'SOHBET BİRİMİ', emoji: '💬' }
};

const RANK_TITLES = {
  1: { emoji: '🟢', label: 'Birim Personeli' },
  2: { emoji: '🟡', label: 'Birim Yardımcısı' },
  3: { emoji: '🟠', label: 'Birim Başkanı' },
  4: { emoji: '🔴', label: 'Birim Müdürü' }
};

/**
 * Ayın sonunda tüm birim üyelerinin sınavını otomatik olarak tetikle
 * Cron job ile her ayın son günü çalışacak
 */
async function triggerMonthlyPromotionCycle(client) {
  try {
    console.log('[monthlyPromotion] 🔄 Aylık terfi döngüsü başlatılıyor...');

    // Tüm birim üyelerini bul
    const allMembers = await StaffUnit.find({ unitName: { $exists: true, $ne: null } });

    if (!allMembers || allMembers.length === 0) {
      console.log('[monthlyPromotion] ℹ️ Birim üyesi bulunamadı');
      return { success: false, message: 'No unit members found' };
    }

    let promotedCount = 0;
    let examinedCount = 0;
    const results = [];

    // Her üye için sınav döngüsünü başlat
    const { hasInactivityRole } = require('./staffSystem');
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    for (const member of allMembers) {
      try {
        // İnaktiflik alanları veya izindekileri atla
        if (await hasInactivityRole(member.userId, client)) {
          console.log(`[monthlyPromotion] Skipping promotion/coach message for inactive/leave user: ${member.userId}`);
          continue;
        }

        // Bu ay zaten gönderilmişse atla
        if (member.lastCoachMotivationMonth === currentMonthStr) {
          console.log(`[monthlyPromotion] Motivation already sent this month for ${member.userId}`);
          continue;
        }

        const user = await client.users.fetch(member.userId).catch(() => null);
        if (!user) continue;

        // Sınav tarihi ayarla (sonraki gün başında)
        const examDate = new Date();
        examDate.setDate(examDate.getDate() + 1);
        examDate.setHours(9, 0, 0, 0);

        // Motivasyon mesajı gönder
        await sendMotivationFromCoach(user, member, client);

        // Gönderildiğini kaydet
        member.lastCoachMotivationMonth = currentMonthStr;
        await member.save();

        examinedCount++;

        // 50ms delay to prevent rate limit
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`[monthlyPromotion] ${member.userId} için hata:`, err.message);
      }
    }

    console.log(`[monthlyPromotion] ✅ Döngü tamamlandı. ${examinedCount} üye incelendi.`);
    return { success: true, examinedCount, promotedCount };
  } catch (err) {
    console.error('[monthlyPromotion] Hata:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Koçtan motivasyon mesajı gönder ve sınava hazırlama notları
 */
async function sendMotivationFromCoach(user, member, client) {
  try {
    const birimLabel = UNIT_CONFIG[member.unitName]?.label || member.unitName;
    const birimEmoji = UNIT_CONFIG[member.unitName]?.emoji || '📌';
    const currentRank = RANK_TITLES[member.rank] || RANK_TITLES[1];
    const nextRank = member.rank < 4 ? RANK_TITLES[member.rank + 1] : null;

    // Koçu bul
    const coach = await getCoachForUnit(member.unitName);
    const coachName = coach?.name || 'Koçunuz';

    // AI ile motivasyon mesajı oluştur
    const motivationPrompt = `Sen ${coachName} adlı ${birimLabel} biriminin koçusun. 
${user.username} adlı ekip üyeniz için motivasyon mesajı yaz.

Bilgiler:
- Mevcut Rütbe: ${currentRank.label}
- ${nextRank ? `Hedef Rütbe: ${nextRank.label}` : 'En Yüksek Rütbedesin'}
- Birim: ${birimLabel}
- Ayın sonunda yeni sınav olacak

Lütfen:
1. Samimi ve motive edici bir ton kullan
2. Bu ay yapması gerekenler hakkında tavsiyelerde bulun (3-4 tavsiye)
3. Sınava hazırlık ipuçları ver
4. Başarısını kutla ve ilerlemesini takdir et

Türkçe, 200-300 kelime arası cevap ver.`;

    let motivationText = await chatWithAI(motivationPrompt);

    if (!motivationText) {
      motivationText = generateFallbackMotivation(user.username, currentRank, nextRank, birimLabel, coachName);
    }

    // Embed oluştur
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`💌 ${coachName}'dan Mesaj`)
      .setDescription(
        `Merhaba **${user.username}**! 👋\n\n` +
        `Ayın sonunda **${birimLabel}** biriminizin aylık sınav ve terfi değerlendirmesi yapılacak. ` +
        `Bu sırada sana bazı tavsiyelerde bulunmak istedim.`
      )
      .addFields(
        {
          name: `${birimEmoji} Birim Koçunuzdan Tavsiyeler`,
          value: motivationText,
          inline: false
        },
        {
          name: '📊 Mevcut Durumunuz',
          value: `**Rütbe:** ${currentRank.emoji} ${currentRank.label}\n` +
                 (nextRank ? `**Hedef:** ${nextRank.emoji} ${nextRank.label}\n` : '') +
                 `**Birim:** ${birimEmoji} ${birimLabel}`,
          inline: false
        },
        {
          name: '🎯 Sınav Tarihi',
          value: `Ayın son günü (${getMonthEndDate()})`,
          inline: false
        }
      )
      .setFooter({ text: `EkoYıldız Birim Sistemi • ${coachName}` })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(err => {
      console.warn(`[monthlyPromotion] DM gönderme hatası (${user.tag}):`, err.message);
    });

    // Koça da motivasyon gönderildiğini bildir (EĞER AYAR AÇIKSA)
    if (coach) {
      const coachNotificationEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📢 Birim Üyesi Motivasyon Mesajı Gönderildi')
        .setDescription(
          `**${user.username}** adlı üyeye motivasyon ve aylık sınav hazırlık mesajını gönderdim.\n\n` +
          `Mevcut rütbesi: ${currentRank.label}`
        )
        .setFooter({ text: 'EkoYıldız Birim Sistemi' })
        .setTimestamp();

      // Koça mesaj gönder (günlük tür - yalnızca "ALL" seviyesinde)
      await sendMessageToCoach(client, coach.discordId, {
        embed: coachNotificationEmbed,
        messageType: 'daily'
      }).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error('[sendMotivationFromCoach] Hata:', err.message);
    return false;
  }
}

/**
 * Fallback motivasyon mesajı
 */
function generateFallbackMotivation(username, currentRank, nextRank, birimLabel, coachName) {
  return `Merhaba ${username},

Bu ay yapman gerekenler:

1️⃣ **Günlük Görevleri Takip Et** - Her gün birim görevlerini tamamla ve raporla

2️⃣ **Etkinliklere Katıl** - Birim etkinliklerine aktif bir şekilde katıl

3️⃣ **Ekip Üyeleriyle Çalış** - Diğer birim üyeleriyle işbirliği yap ve destekle

4️⃣ **Sorumlulukları Al** - Birim için ekstra sorumluluklar alarak kendini göster

${nextRank ? `
**Sınava Hazırlık İpuçları:**
- Birim kurallarını tekrar gözden geçir
- Geçen ayın sınav sorularını çalış
- Birim tarihçesini öğren
- Liderlik becerilerini geliştir
` : ''}

Başarılarından gurur duyuyorum. Devam et! 💪`;
}

/**
 * Belirtilen birim için koçu getir
 */
async function getCoachForUnit(birimKey) {
  try {
    const coaches = await Coach.find({ isActive: true });
    if (!coaches || coaches.length === 0) return null;

    // Bu birime atanmış koçu bul
    const coach = coaches.find(c =>
      c.assignedBranches && c.assignedBranches.includes(birimKey)
    );

    return coach || coaches[0]; // Fallback to first coach
  } catch (err) {
    console.error('[getCoachForUnit] Hata:', err.message);
    return null;
  }
}

/**
 * Ayın son gününü hesapla
 */
function getMonthEndDate() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return lastDay.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Sınav sonuçlarına göre otomatik terfi işlemini gerçekleştir
 */
async function processPromotionAfterExam(userId, birimKey, score, client) {
  try {
    const staffUnit = await StaffUnit.findOne({ userId });
    if (!staffUnit) {
      console.error(`[promotion] StaffUnit not found for ${userId}`);
      return { success: false, error: 'User not in a unit' };
    }

    let promotion = null;

    // Skorya göre terfi karar ver
    if (score >= 9 && staffUnit.rank < 4) {
      // Yüksek skor = terfi
      promotion = {
        oldRank: staffUnit.rank,
        newRank: staffUnit.rank + 1,
        promoted: true
      };
      staffUnit.rank = promotion.newRank;
      staffUnit.lastPromotionDate = new Date();
    } else if (score < 6 && staffUnit.rank > 1) {
      // Düşük skor = rütbe düşürme (uyarı)
      promotion = {
        oldRank: staffUnit.rank,
        newRank: Math.max(1, staffUnit.rank - 1),
        demoted: true
      };
      staffUnit.rank = promotion.newRank;
    }

    if (promotion) {
      await staffUnit.save();
      await notifyPromotionResult(userId, birimKey, score, promotion, client);
      return { success: true, promotion };
    }

    return { success: false, message: 'No promotion/demotion' };
  } catch (err) {
    console.error('[processPromotionAfterExam] Hata:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Terfi/Tenzilat sonucunu kullanıcıya bildir
 */
async function notifyPromotionResult(userId, birimKey, score, promotion, client) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return;

    const birimLabel = UNIT_CONFIG[birimKey]?.label || birimKey;
    const oldRankInfo = RANK_TITLES[promotion.oldRank];
    const newRankInfo = RANK_TITLES[promotion.newRank];

    let embed;

    if (promotion.promoted) {
      embed = new EmbedBuilder()
        .setColor(0x2ECC71)
        .setTitle('🎉 TEBRİKLER! TERFİ ALDINIZ!')
        .setDescription(
          `**${birimLabel}}** biriminde aylık sınava ${score}/10 puan ile başarılı oldunuz!\n\n` +
          `🟢 **Eski Rütbe:** ${oldRankInfo.emoji} ${oldRankInfo.label}\n` +
          `🟡 **Yeni Rütbe:** ${newRankInfo.emoji} ${newRankInfo.label}\n\n` +
          `Harika bir başarı! Ekibinize kattığınız değer için teşekkürler. 🚀`
        )
        .setFooter({ text: 'EkoYıldız Birim Sistemi • Aylık Terfi' })
        .setTimestamp();
    } else if (promotion.demoted) {
      embed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle('⚠️ Rütbe Düşürme')
        .setDescription(
          `**${birimLabel}}** biriminde aylık sınava ${score}/10 puan ile başarısız oldunuz.\n\n` +
          `🟡 **Eski Rütbe:** ${oldRankInfo.emoji} ${oldRankInfo.label}\n` +
          `🟢 **Yeni Rütbe:** ${newRankInfo.emoji} ${newRankInfo.label}\n\n` +
          `Sağlık olsun! Gelecek ay daha iyi hazırlanarak sınava girin. 💪`
        )
        .setFooter({ text: 'EkoYıldız Birim Sistemi • Aylık Sınav' })
        .setTimestamp();
    }

    if (embed) {
      await user.send({ embeds: [embed] }).catch(err => {
        console.warn(`[notifyPromotionResult] DM gönderme hatası:`, err.message);
      });

      // Koça da sonucu bildir (IMPORTANT - Filtreli)
      const coach = await getCoachForUnit(birimKey);
      if (coach) {
        const messageTypeEmoji = promotion.promoted ? '🎉' : '⚠️';
        const messageType = promotion.promoted ? 'promotion' : 'demotion';

        const coachEmbed = new EmbedBuilder()
          .setColor(promotion.promoted ? 0x2ECC71 : 0xE74C3C)
          .setTitle(`${messageTypeEmoji} Birim Üyesi ${promotion.promoted ? 'Terfi' : 'Tenzilat'}`)
          .setDescription(
            `**${user.username}** adlı üyeniz aylık sınavda ${score}/10 puan aldı.\n\n` +
            `${promotion.promoted ? 
              `✅ **Terfi Aldı:** ${oldRankInfo.label} → ${newRankInfo.label}` :
              `⚠️ **Tenzilat Oldu:** ${oldRankInfo.label} → ${newRankInfo.label}`
            }`
          )
          .setFooter({ text: 'EkoYıldız Birim Sistemi' })
          .setTimestamp();

        await sendMessageToCoach(client, coach.discordId, {
          embed: coachEmbed,
          messageType: messageType // "promotion" veya "demotion" - IMPORTANT seviyesinde gider
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[notifyPromotionResult] Hata:', err.message);
  }
}

module.exports = {
  triggerMonthlyPromotionCycle,
  sendMotivationFromCoach,
  processPromotionAfterExam,
  notifyPromotionResult,
  getCoachForUnit,
  startMonthlyPromotionScheduler
};

/**
 * Aylık terfi döngüsünü zamanla (her ayın son günü saat 20:00'de)
 */
function startMonthlyPromotionScheduler(client) {
  console.log('[monthlyPromotion] 📅 Aylık terfi döngüsü planlayıcısı başlatıldı');

  // Saati kontrol et ve gerekirse planı ayarla
  function scheduleNextCycle() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Ayın son gününü bul
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const scheduleTime = new Date(lastDay);
    scheduleTime.setHours(20, 0, 0, 0); // Saat 20:00

    let timeUntilNext = scheduleTime.getTime() - now.getTime();

    // Eğer bu ayın son günü geçtiyse, gelecek ayın son gününü ayarla
    if (timeUntilNext < 0) {
      const nextMonth = new Date(currentYear, currentMonth + 2, 0);
      const nextSchedule = new Date(nextMonth);
      nextSchedule.setHours(20, 0, 0, 0);
      timeUntilNext = nextSchedule.getTime() - now.getTime();
    }

    const nextScheduleTime = new Date(now.getTime() + timeUntilNext);
    console.log(`[monthlyPromotion] ⏰ Sonraki çalışma: ${nextScheduleTime.toLocaleString('tr-TR')}`);

    // Schedule ile planla
    setTimeout(async () => {
      console.log('[monthlyPromotion] 🚀 Aylık terfi döngüsü şimdi başlatılıyor!');
      try {
        await triggerMonthlyPromotionCycle(client);
      } catch (err) {
        console.error('[monthlyPromotion] Planlanan çalışma hatası:', err.message);
      }
      // Sonraki döngüyü planla
      scheduleNextCycle();
    }, timeUntilNext);
  }

  // İlk döngüyü planla
  scheduleNextCycle();
}
