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
 * Ayın sonunda tüm birim üyelerine SADECE ORT DERECEDC ÖDÜL ver
 * Haftalık/aylık terfi sistemi kaldırıldı - şimdi sadece motivasyon mesajı gönderiliyor
 * Cron job ile her ayın son günü çalışacak
 */
async function triggerMonthlyPromotionCycle(client) {
  try {
    console.log('[monthlyPromotion] 📢 Aylık motivasyon ve orta derece ödül döngüsü başlatılıyor...');

    // Tüm birim üyelerini bul
    const allMembers = await StaffUnit.find({ unitName: { $exists: true, $ne: null } });

    if (!allMembers || allMembers.length === 0) {
      console.log('[monthlyPromotion] ℹ️ Birim üyesi bulunamadı');
      return { success: false, message: 'No unit members found' };
    }

    let rewardedCount = 0;
    const results = [];

    // Her üye için orta derece ödül ver
    const { hasInactivityRole } = require('./staffSystem');
    const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    for (const member of allMembers) {
      try {
        // İnaktiflik alanları veya izindekileri atla
        if (await hasInactivityRole(member.userId, client)) {
          console.log(`[monthlyPromotion] Skipping reward for inactive/leave user: ${member.userId}`);
          continue;
        }

        // Bu ay zaten gönderilmişse atla
        if (member.lastCoachMotivationMonth === currentMonthStr) {
          console.log(`[monthlyPromotion] Reward already sent this month for ${member.userId}`);
          continue;
        }

        const user = await client.users.fetch(member.userId).catch(() => null);
        if (!user) continue;

        // Orta derece ödül gönder (terfi yok, sadece motivasyon ve ödül)
        await sendMonthlyMediumReward(user, member, client);

        // Gönderildiğini kaydet
        member.lastCoachMotivationMonth = currentMonthStr;
        await member.save();

        rewardedCount++;

        // 50ms delay to prevent rate limit
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`[monthlyPromotion] ${member.userId} için hata:`, err.message);
      }
    }

    console.log(`[monthlyPromotion] ✅ Döngü tamamlandı. ${rewardedCount} üyeye ödül verildi.`);
    return { success: true, rewardedCount };
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

    // Orta derece ödülü gönder
    const rewardEmbed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🎁 Aylık Motivasyon & Orta Derece Ödül`)
      .setDescription(
        `Merhaba **${user.username}**! 👋\n\n` +
        `Bu ay **${birimLabel}** biriminde gösterdiğin başarı ve çabalarından dolayı sana özel ödül hazırladık!`
      )
      .addFields(
        {
          name: `${birimEmoji} Birim Motivasyonu`,
          value: 
            `Bu ay da **${birimLabel}** biriminin değerli bir üyesi oldun!\n\n` +
            `✅ Görevleri yerine getirdin\n` +
            `✅ Takımla işbirliği yaptın\n` +
            `✅ Birimine katkı sağladın\n\n` +
            `**Teşekkürler! Devam et! 💪`,
          inline: false
        },
        {
          name: '🏆 Mevcut Durumunuz',
          value: `**Rütbe:** ${currentRank.emoji} ${currentRank.label}\n` +
                 `**Birim:** ${birimEmoji} ${birimLabel}`,
          inline: false
        },
        {
          name: '🎁 Bu Ayın Ödülü',
          value: `**Orta Derece Ödül:** 500 EkoCoin\n` +
                 `**Özel Badge:** 🌟 Loyal Member\n` +
                 `**Bonus:** +50 XP`,
          inline: false
        },
        {
          name: '📌 Not',
          value: `Terfi sistemimiz yerine sadece performans ödülüne geçtik. Her ay orta derece ödülü alacaksın.`,
          inline: false
        }
      )
      .setFooter({ text: `EkoYıldız Birim Sistemi` })
      .setTimestamp();

    await user.send({ embeds: [rewardEmbed] }).catch(err => {
      console.warn(`[monthlyPromotion] DM gönderme hatası (${user.tag}):`, err.message);
    });

    return true;
  } catch (err) {
    console.error('[sendMotivationFromCoach] Hata:', err.message);
    return false;
  }
}

/**
 * Fallback motivasyon mesajı (kullanımdan kaldırıldı - sadece ödül kalıyor)
 */
function generateFallbackMotivation(username, currentRank, nextRank, birimLabel, coachName) {
  return `Bu ay harika bir performans gösterdin! Teşekkürler.`;
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
  sendMonthlyMediumReward,
  getCoachForUnit,
  startMonthlyPromotionScheduler
};

/**
 * Aylık terfi döngüsünü zamanla (her ayın son günü saat 20:00'de)
 */
function startMonthlyPromotionScheduler(client) {
  console.log('[monthlyPromotion] 📅 Aylık terfi döngüsü planlayıcısı başlatıldı (cron ile)');

  const cron = require('node-cron');
  cron.schedule('0 20 * * *', async () => {
    if (global.SPAM_STOPPED) {
      console.log('[monthlyPromotion] Cron execution skipped (global.SPAM_STOPPED is true)');
      return;
    }
    try {
      const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
      const today = tzDate.getDate();
      const lastDay = new Date(tzDate.getFullYear(), tzDate.getMonth() + 1, 0).getDate();

      if (today === lastDay) {
        console.log('[monthlyPromotion] 🚀 Bugün ayın son günü! Aylık terfi döngüsü başlatılıyor...');
        await triggerMonthlyPromotionCycle(client);
      } else {
        console.log(`[monthlyPromotion] Bugün ayın son günü değil (${today}/${lastDay}). Çalıştırılmadı.`);
      }
    } catch (err) {
      console.error('[monthlyPromotion] Cron çalışırken hata:', err.message);
    }
  }, {
    timezone: "Europe/Istanbul"
  });
}
