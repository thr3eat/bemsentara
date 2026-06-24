'use strict';

const { EmbedBuilder } = require('discord.js');
const Coach = require('../../models/Coach');
const fs = require('fs');
const path = require('path');

// Startup flag dosyası - bot'un ilk kez başlatıldığını kontrol etmek için
const STARTUP_FLAG_FILE = path.join(__dirname, '../../data/.coach_welcome_sent');

/**
 * Bot başlatıldığında koçlara hoşgeldin mesajı gönder (tek seferlik)
 */
async function sendCoachWelcomeOnStartup(client) {
  try {
    // Eğer bu sefer zaten gönderdiyse, tekrar gönderme
    if (fs.existsSync(STARTUP_FLAG_FILE)) {
      console.log('[coachWelcome] ℹ️ Koç hoşgeldin mesajı bu sefer zaten gönderilmiş');
      return { success: false, message: 'Already sent this startup' };
    }

    // Tüm aktif koçları bul
    const coaches = await Coach.find({ isActive: true });
    
    if (!coaches || coaches.length === 0) {
      console.log('[coachWelcome] ⚠️ Aktif koç bulunamadı');
      // Flag'ı koy ki sonra tekrar denemesin
      createStartupFlag();
      return { success: false, message: 'No active coaches found' };
    }

    let sentCount = 0;

    for (const coach of coaches) {
      try {
        const user = await client.users.fetch(coach.discordId).catch(() => null);
        
        if (!user) {
          console.warn(`[coachWelcome] ⚠️ Koç kullanıcısı bulunamadı (ID: ${coach.discordId})`);
          continue;
        }

        // Hoşgeldin embed'i oluştur
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle('👋 BİRİM SİSTEMİ - HOŞ GELDİN!')
          .setDescription(
            `Merhaba **${coach.name || user.username}**! 🎯\n\n` +
            `Bot başarıyla başlatıldı ve birim sistemi aktif hale geldi. Koçları yönetmenizi ve ` +
            `ekip üyelerinizi desteklemenizi umuyoruz.\n\n` +
            `**Görevleriniz:**\n` +
            `✅ Birim üyelerinize rehberlik sağlamak\n` +
            `✅ Aylık sınav dönemlerinde motivasyon vermek\n` +
            `✅ Performans değerlendirmelerini yapmak\n` +
            `✅ Terfi/tenzilat kararlarında destek olmak\n\n` +
            `**Sisteme Giriş:**\n` +
            `🔗 Kontrol paneli: `/panel` komutu\n` +
            `📊 Liderbordu: Paneldeki "🏆 Birim Sistemi" sekmesi\n` +
            `👥 Ekip Yönetimi: Birim üyelerinizi takip edin\n\n` +
            `Sorularınız olursa, sistem yöneticileri sizi yardımcı olmak için hazır.`
          )
          .addFields(
            {
              name: '🎖️ Atanmış Birimler',
              value: coach.assignedBranches && coach.assignedBranches.length > 0 
                ? coach.assignedBranches.join(', ')
                : 'Henüz bir birim atanmamış',
              inline: false
            },
            {
              name: '⏰ Sistem Bilgileri',
              value: `**Bot Başlatılması:** ${new Date().toLocaleString('tr-TR')}\n**Durum:** 🟢 Aktif\n**Sürüm:** Sezon 1/2`,
              inline: false
            }
          )
          .setThumbnail(user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: 'EkoYıldız Birim Koç Sistemi' })
          .setTimestamp();

        // Mesajı gönder
        await user.send({ embeds: [welcomeEmbed] });
        sentCount++;

        console.log(`[coachWelcome] ✅ ${coach.name || user.username}'a hoşgeldin mesajı gönderildi`);

        // Rate limiting'i önlemek için 500ms bekle
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[coachWelcome] Koç ${coach.discordId} için hata:`, err.message);
      }
    }

    // Tümü tamamlandı, flag'ı oluştur
    createStartupFlag();

    console.log(`[coachWelcome] ✅ ${sentCount}/${coaches.length} koça mesaj gönderildi`);
    return {
      success: true,
      sentCount,
      totalCoaches: coaches.length,
    };
  } catch (err) {
    console.error('[coachWelcome] Hata:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Startup flag dosyasını oluştur
 * Bu dosya bot'un koçlara mesaj gönderdiğini işaretler
 */
function createStartupFlag() {
  try {
    const dataDir = path.join(__dirname, '../../data');
    
    // data klasörü yoksa oluştur
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Flag dosyasını oluştur ve timestamp ekle
    const timestamp = new Date().toISOString();
    fs.writeFileSync(STARTUP_FLAG_FILE, `Bot started at: ${timestamp}`);
    
    console.log('[coachWelcome] 📝 Startup flag dosyası oluşturuldu');
  } catch (err) {
    console.error('[coachWelcome] Flag dosyası oluşturma hatası:', err.message);
  }
}

/**
 * Flag dosyasını sil (manuel olarak - yönetici tarafından)
 * Bunu kullanarak koçlara tekrar mesaj gönderilebilir
 */
function resetCoachWelcomeFlag() {
  try {
    if (fs.existsSync(STARTUP_FLAG_FILE)) {
      fs.unlinkSync(STARTUP_FLAG_FILE);
      console.log('[coachWelcome] 🔄 Startup flag sıfırlandı. Sonraki başlatmada koçlara mesaj gönderilecek.');
      return { success: true, message: 'Flag reset successful' };
    } else {
      return { success: false, message: 'Flag file does not exist' };
    }
  } catch (err) {
    console.error('[coachWelcome] Flag sıfırlama hatası:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendCoachWelcomeOnStartup,
  resetCoachWelcomeFlag,
};
