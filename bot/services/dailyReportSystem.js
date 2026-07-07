'use strict';

const { EmbedBuilder } = require('discord.js');
const StaffProgress = require('../../models/StaffProgress');
const { chatWithAI } = require('./aiService');

/**
 * Moderatörlerin günlük rapor girmesini sağlar
 * AI tarafından değerlendirilir ve puan/XP verilir
 */
async function handleDailyReport(interaction) {
  try {
    const reportText = interaction.options.getString('rapor');

    // Gönderici kontrol
    const { getOrCreate } = require('./staffSystem');
    const staff = await getOrCreate(interaction.user.id, interaction.guildId, interaction.client);
    if (!staff || staff.status !== 'active') {
      return interaction.reply({ content: '❌ Sadece aktif personeller rapor girebilir.', ephemeral: true });
    }

    // Defer ve rapor işle
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    // AI ile rapor değerlendir
    const evaluation = await evaluateReport(reportText, staff.level, interaction.user.username);

    // Puanları ve XP'yi ver
    const pointsAwarded = evaluation.pointsAwarded;
    const xpAwarded = evaluation.xpAwarded;
    const ecoCoinsAwarded = evaluation.ecoCoinsAwarded;

    // Personel sistemini güncelle
    staff.gamification.totalPoints = (staff.gamification.totalPoints || 0) + pointsAwarded;
    staff.gamification.currentXP = (staff.gamification.currentXP || 0) + xpAwarded;
    staff.gamification.ecoCoins = (staff.gamification.ecoCoins || 0) + ecoCoinsAwarded;
    
    // Rapor sayısı
    staff.stats.weeklyReports = (staff.stats.weeklyReports || 0) + 1;
    
    // Rapor geçmişi
    if (!staff.modReports) {
      staff.modReports = {
        unloggedCount: 0,
        totalReports: 0,
        totalPenalties: 0,
        lastPenaltyDate: null
      };
    }
    staff.modReports.totalReports = (staff.modReports.totalReports || 0) + 1;
    
    await staff.save();

    // Sonuç embedi
    const resultEmbed = new EmbedBuilder()
      .setTitle('📋 Günlük Rapor Değerlendirildi')
      .setDescription(`**AI Değerlendirmesi:**\n${evaluation.feedback}`)
      .setColor(evaluation.rating === 'mükemmel' ? 0x2ecc71 : evaluation.rating === 'iyi' ? 0x3498db : 0xf39c12)
      .addFields(
        { name: '⭐ Değerlendirme', value: `${evaluation.ratingEmoji} ${evaluation.rating.toUpperCase()}`, inline: true },
        { name: '📈 Rapor İçeriği Kalitesi', value: `${evaluation.qualityScore}/10`, inline: true },
        { name: '🎯 Aktivite Seviyesi', value: `${evaluation.activityScore}/10`, inline: true },
        { name: '💰 Ödüller', value: `💎 **${pointsAwarded}** Puan\n⚡ **${xpAwarded}** XP\n🪙 **${ecoCoinsAwarded}** EkoCoin`, inline: false },
        { name: '📝 Rapor', value: `\`\`\`\n${reportText.slice(0, 200)}\n\`\`\``, inline: false }
      )
      .setFooter({ text: `Toplam Rapor Sayısı: ${staff.modReports.totalReports}` })
      .setTimestamp();

    return interaction.editReply({ embeds: [resultEmbed] });

  } catch (err) {
    console.error('[dailyReportSystem] Hata:', err.message);
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: `❌ Rapor işlenirken hata oluştu: ${err.message}`, ephemeral: true });
    }
    return interaction.editReply({ content: `❌ Rapor işlenirken hata oluştu: ${err.message}` });
  }
}

/**
 * AI ile raporu değerlendir
 * @param {string} reportText 
 * @param {number} staffLevel 
 * @param {string} username 
 */
async function evaluateReport(reportText, staffLevel, username) {
  try {
    const systemPrompt = `Sen bir personel performans değerlendirme AI'sısın. Moderatörlerin günlük raporlarını değerlendir ve puanlama yap. Türkçe cevap ver.`;

    const userPrompt = `
Aşağıdaki moderatör raporunu değerlendir ve JSON formatında yanıt ver. SADECE JSON, başka hiçbir metin yazma:

**Moderatör:** ${username}
**Seviye:** Level ${staffLevel}
**Rapor:** "${reportText}"

Lütfen şu JSON'u oluştur:
{
  "rating": "mükemmel|iyi|orta|zayıf",
  "ratingEmoji": "🌟|⭐|✅|⚠️",
  "feedback": "Kısa değerlendirme (max 100 karakter)",
  "qualityScore": 1-10 arası sayı,
  "activityScore": 1-10 arası sayı,
  "pointsAwarded": 20-100 arası,
  "xpAwarded": 10-50 arası,
  "ecoCoinsAwarded": 5-25 arası
}

Değerlendirme kriterleri:
- "Uyandım selam verdim" gibi kısa cümleler = zayıf (düşük puan)
- "Sesle 2 saat aktif oldum, 5 ticket çözdüm" = iyi (orta puan)
- Detaylı, çok faaliyetli raporlar = mükemmel (yüksek puan)
- Yazım hatası/eksik bilgi = puandan düş
`;

    let aiResponse = await chatWithAI([{ role: 'user', content: userPrompt }], systemPrompt);

    // Think tags'i temizle
    aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // JSON çıkart
    const jsonStart = aiResponse.indexOf('{');
    const jsonEnd = aiResponse.lastIndexOf('}');
    const jsonStr = aiResponse.slice(jsonStart, jsonEnd + 1);
    const evaluation = JSON.parse(jsonStr);

    // Varsayılan değerleri güvenle ayarla
    return {
      rating: evaluation.rating || 'orta',
      ratingEmoji: evaluation.ratingEmoji || '✅',
      feedback: evaluation.feedback || 'Raporunuz kaydedildi.',
      qualityScore: Math.min(10, Math.max(1, evaluation.qualityScore || 5)),
      activityScore: Math.min(10, Math.max(1, evaluation.activityScore || 5)),
      pointsAwarded: Math.min(100, Math.max(20, evaluation.pointsAwarded || 50)),
      xpAwarded: Math.min(50, Math.max(10, evaluation.xpAwarded || 25)),
      ecoCoinsAwarded: Math.min(25, Math.max(5, evaluation.ecoCoinsAwarded || 10))
    };

  } catch (aiErr) {
    console.warn('[dailyReportSystem] AI değerlendirmesi başarısız, fallback kullanılıyor:', aiErr.message);

    // Fallback: Basit heuristic
    const wordCount = reportText.split(/\s+/).length;
    let rating = 'orta';
    let points = 50;
    let xp = 25;
    let ecoCoins = 10;
    let quality = 5;
    let activity = 5;

    if (wordCount < 5) {
      rating = 'zayıf';
      points = 25;
      xp = 10;
      ecoCoins = 5;
      quality = 2;
      activity = 2;
    } else if (wordCount > 30) {
      rating = 'iyi';
      points = 75;
      xp = 35;
      ecoCoins = 15;
      quality = 7;
      activity = 7;
    } else if (wordCount > 50) {
      rating = 'mükemmel';
      points = 100;
      xp = 50;
      ecoCoins = 25;
      quality = 10;
      activity = 10;
    }

    return {
      rating,
      ratingEmoji: rating === 'mükemmel' ? '🌟' : rating === 'iyi' ? '⭐' : rating === 'orta' ? '✅' : '⚠️',
      feedback: `Raporunuz ${rating} olarak değerlendirildi.`,
      qualityScore: quality,
      activityScore: activity,
      pointsAwarded: points,
      xpAwarded: xp,
      ecoCoinsAwarded: ecoCoins
    };
  }
}

module.exports = { handleDailyReport, evaluateReport };
