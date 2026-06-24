'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { chatWithAI } = require('./aiService');
const StaffUnit = require('../../models/StaffUnit');
const StaffProgress = require('../../models/StaffProgress');
const User = require('../../models/User');

// Birim konfigürasyonları
const UNIT_CONFIG = {
  BAN_BIRIMI: { label: 'BAN BİRİMİ', emoji: '🛡️' },
  SES_BIRIMI: { label: 'SES BİRİMİ', emoji: '🎤' },
  SOHBET_BIRIMI: { label: 'SOHBET BİRİMİ', emoji: '💬' }
};

/**
 * Birime yeni katılan kişiyi AI tarafından tanıtır ve günlük görevleri verir
 * @param {Object} client - Discord client
 * @param {string} userId - Yeni üye Discord ID
 * @param {string} birimKey - Birim anahtarı (BAN_BIRIMI, SES_BIRIMI, vb)
 * @param {number} score - Sınav puanı (1-10)
 */
async function onboardNewMember(client, userId, birimKey, score) {
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      console.error(`[unitOnboarding] Kullanıcı ${userId} bulunamadı`);
      return false;
    }

    const birimLabel = UNIT_CONFIG[birimKey]?.label || birimKey;
    const birimEmoji = UNIT_CONFIG[birimKey]?.emoji || '📌';

    // 1. Tanıtım Mesajı Gönder
    await sendIntroductionMessage(user, birimKey, birimLabel, birimEmoji, score);

    // 2. AI ile Görevler Oluştur
    await sendAIDailyTasks(user, birimKey, birimLabel, birimEmoji, score);

    // 3. Veritabanı güncelle
    const staffUnit = await StaffUnit.findOne({ userId });
    if (staffUnit) {
      staffUnit.onboardedAt = new Date();
      staffUnit.tasksAssignedToday = true;
      await staffUnit.save();
    }

    console.log(`[unitOnboarding] ✅ ${user.tag} başarıyla ${birimLabel} birimine dahil edildi`);
    return true;
  } catch (err) {
    console.error('[unitOnboarding] Hata:', err.message);
    return false;
  }
}

/**
 * Tanıtım embed mesajı gönderir
 */
async function sendIntroductionMessage(user, birimKey, birimLabel, birimEmoji, score) {
  try {
    const { getCoachForUnit } = require('./unitMonthlyPromotionService');
    const coach = await getCoachForUnit(birimKey);
    const coachInfo = coach ? `👨‍🏫 **Birim Koçunuz:** ${coach.name}` : '👨‍🏫 **Birim Koçunuz:** Rehberiniz atanmıştır';

    const startingRank = score === 10 ? 3 : (score === 9 ? 2 : 1);
    const rankTitles = {
      1: '🟢 Birim Personeli',
      2: '🟡 Birim Yardımcısı',
      3: '🟠 Birim Başkanı'
    };

    const rankTitle = rankTitles[startingRank] || 'Birim Personeli';

    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`${birimEmoji} HOŞ GELDİN ${user.username}!`)
      .setDescription(
        `Tebrikler! **${birimLabel}** birimine resmi olarak kabul edildin!\n\n` +
        `Sınav puanın: **${score}/10** ⭐\n` +
        `Başlangıç Rütben: **${rankTitle}**\n\n` +
        `Birime hoş geldin! Şimdi sana günlük görevlerini ve sorumlulukların anlatacağım. 📋`
      )
      .addFields(
        { name: '📖 Birim Hakkında', value: getBirimInfo(birimKey), inline: false },
        { name: '✅ Sizin Görevleriniz', value: 'Aşağıda günlük görevlerinizi bulabilirsiniz. ⬇️', inline: false },
        { name: coachInfo.split(':')[0], value: coachInfo.split(':')[1], inline: false }
      )
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: 'EkoYıldız Birim Sistemi • Hoş Geldin', iconURL: 'https://cdn.discordapp.com/emojis/1234567890.png' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(err => {
      console.warn(`[unitOnboarding] DM gönderme hatası (${user.tag}):`, err.message);
    });
  } catch (err) {
    console.error('[sendIntroductionMessage] Hata:', err.message);
  }
}

/**
 * AI ile bugünün görevlerini oluştur ve gönder
 */
async function sendAIDailyTasks(user, birimKey, birimLabel, birimEmoji, score) {
  try {
    const { getCoachForUnit } = require('./unitMonthlyPromotionService');
    const coach = await getCoachForUnit(birimKey);
    const coachName = coach?.name || 'Birim Koçunuz';

    const startingRank = score === 10 ? 3 : (score === 9 ? 2 : 1);
    const rankNames = { 1: 'Personel', 2: 'Yardımcı', 3: 'Başkan' };

    const systemPrompt = `Sen ${birimLabel} birimine yeni katılmış bir üyenin rehberi ve görev vericisin.
Sınav puanı: ${score}/10
Rütbe: ${rankNames[startingRank]}

Lütfen bu kişiye:
1. Birimde yapması gerekenler hakkında kısa bilgi ver
2. Bugün başlaması gereken 3-5 görev öner
3. Birimin kurallarını hatırlat
4. Başarısını kutla ve motive et

Cevapla Turkish dilinde, samimi ve motive edici bir ton kullan.
Görevler konkret ve yapılabilir olmalı (örn: "Kanal ayarlarını öğren", "İlk sunumunu yap", vb).
Format: Her görev başında ✅ koy ve numalandır.`;

    const tasksResponse = await chatWithAI(systemPrompt);

    if (!tasksResponse) {
      // Fallback görevler
      return sendFallbackTasks(user, birimLabel, birimEmoji, startingRank);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📋 ${birimEmoji} Bugünkü Görevler`)
      .setDescription(tasksResponse)
      .addFields(
        { name: '💡 İpucu', value: 'Bu görevleri tamamlamak seni birime daha yakınlaştıracak ve seni hızlı terfi ettirebilir! 🚀', inline: false },
        { name: '⏰ Tamamlama Süresi', value: 'Bugün içinde tamamlamaya çalış. Görevleri yapıp bot tarafından takip edilecek.', inline: false },
        { name: `👨‍🏫 BİRİM KOÇUNA DANIŞ: ${coachName}`, value: 'Sorularınız veya yardıma ihtiyacınız olursa koçunuza ulaşabilirsiniz.', inline: false }
      )
      .setFooter({ text: 'EkoYıldız Birim Sistemi • Günlük Görev Listesi' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(err => {
      console.warn(`[unitOnboarding] Görev embed gönderme hatası:`, err.message);
    });

    // Motivasyon mesajı
    const motivationEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('💪 Senden Beklentilerimiz')
      .setDescription(
        `**${birimLabel}** birimine hoş geldin! İşte başlangıç olarak neler beklediğimiz:\n\n` +
        `1️⃣ **Disiplin** - Günlük görevleri takip et\n` +
        `2️⃣ **İşbirliği** - Ekip üyeleriyle çalış\n` +
        `3️⃣ **Gelişim** - Kendini geliştirmeye devam et\n` +
        `4️⃣ **Sorumluluk** - Verilen işleri ciddiye al\n\n` +
        `Başarılı olursan hızlı bir şekilde rütbe atlayabilirsin! 🏆\n\n` +
        `👨‍🏫 **BİRİM KOÇUNA DANIŞ:** ${coachName}`
      )
      .setFooter({ text: 'Bizimle başarılı bir yolculuğun olsun!' })
      .setTimestamp();

    await user.send({ embeds: [motivationEmbed] }).catch(err => {
      console.warn(`[unitOnboarding] Motivasyon mesajı gönderme hatası:`, err.message);
    });

  } catch (err) {
    console.error('[sendAIDailyTasks] Hata:', err.message);
    // Fallback tasks gönder
    return sendFallbackTasks(user, birimLabel, birimEmoji);
  }
}

/**
 * Fallback görevler (AI başarısız olursa)
 */
async function sendFallbackTasks(user, birimLabel, birimEmoji, startingRank) {
  try {
    const fallbackTasks = [
      `✅ **Birim Kanallarını Keşfet** - Birimine ait tüm kanalları gez ve oradaki duyuruları oku`,
      `✅ **Birim Rehberine Katıl** - Birim başkanı veya yardımcısı ile iletişime geç ve rehberlik al`,
      `✅ **Profil Bilgilerini Tamamla** - Roblox hesabını doğrula ve Discord profilini güncelle`,
      `✅ **Birim Sunumu Yap** - Sesli kanalda birim üyelerine kendini tanıt`,
      `✅ **Günlük Görevleri Takip Et** - Her gün görev listesini kontrol et ve raporla`
    ];

    let tasksText = fallbackTasks.join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x3498DB)
      .setTitle(`📋 ${birimEmoji} Bugünkü Görevler`)
      .setDescription(tasksText)
      .addFields(
        { name: '💡 Not', value: 'Bu görevleri tamamladıktan sonra birim yöneticisine rapor et.', inline: false }
      )
      .setFooter({ text: 'EkoYıldız Birim Sistemi • Başlangıç Görevleri' })
      .setTimestamp();

    await user.send({ embeds: [embed] }).catch(err => {
      console.warn(`[unitOnboarding] Fallback görev gönderme hatası:`, err.message);
    });
  } catch (err) {
    console.error('[sendFallbackTasks] Hata:', err.message);
  }
}

/**
 * Birim hakkında bilgi döndür
 */
function getBirimInfo(birimKey) {
  const birimInfos = {
    BAN_BIRIMI: '🔴 **Ban Birimi** - Sunucuyu spam ve kötü davranışlardan korur. Kural ihlalleri araştırır ve ceza uygular.',
    SES_BIRIMI: '🔵 **Ses Birimi** - Sesli kanallarda düzen sağlar ve etkinlikler organize eder.',
    SOHBET_BIRIMI: '💬 **Sohbet Birimi** - Text kanallarında tartışmaları yönetir ve topluluk hareketini destekler.'
  };

  return birimInfos[birimKey] || '📌 Birim hakkında bilgi alabilirsiniz.';
}

/**
 * Yeni üyeyi görsel bir hoş geldin kartı ile selamla
 */
async function sendWelcomeCard(user, birimKey, birimLabel, score) {
  try {
    const startingRank = score === 10 ? 3 : (score === 9 ? 2 : 1);
    const rankEmojis = { 1: '🟢', 2: '🟡', 3: '🟠' };
    const rankTitles = { 1: 'Personel', 2: 'Yardımcı', 3: 'Başkan' };

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle(`🎊 ${birimLabel} Birimine Hoş Geldin!`)
      .setDescription(
        `Başarılı geçiş sınavından sonra resmi olarak ${birimLabel} birimine katıldın! 🎉\n\n` +
        `**Puanın:** ${score}/10 ⭐\n` +
        `**Rütbun:** ${rankEmojis[startingRank]} ${rankTitles[startingRank]}`
      )
      .setImage('https://via.placeholder.com/600x300?text=EkoYildiz+Unit+System')
      .setFooter({ text: 'Birime hoş geldin! Başarılar dileriz 🚀' })
      .setTimestamp();

    await user.send({ embeds: [welcomeEmbed] }).catch(err => {
      console.warn(`[unitOnboarding] Welcome card gönderme hatası:`, err.message);
    });
  } catch (err) {
    console.error('[sendWelcomeCard] Hata:', err.message);
  }
}

module.exports = {
  onboardNewMember,
  sendIntroductionMessage,
  sendAIDailyTasks,
  sendFallbackTasks,
  sendWelcomeCard
};
