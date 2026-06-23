'use strict';

const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8906443471:AAHWNkdq4kMrLsVD-GwySfOXEcLWpKDcUZU";
let cachedChatId = process.env.TELEGRAM_CHAT_ID || "8683506546";

const recentMessages = []; // Timestamps of recent messages

function recordMessage() {
  recentMessages.push(Date.now());
}

function getRecentMessageCount() {
  const limit = Date.now() - 10 * 60 * 1000; // last 10 minutes
  // Clean up older timestamps
  while (recentMessages.length > 0 && recentMessages[0] < limit) {
    recentMessages.shift();
  }
  return recentMessages.length;
}

/**
 * Dinamik olarak /getUpdates endpointinden en son mesaj yazan chat ID'sini çeker ve kaydeder.
 */
async function getTelegramChatId() {
  if (cachedChatId) return cachedChatId;
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`);
    const updates = response.data?.result || [];
    // En yeni güncellemeden eskiye doğru tara
    for (const update of [...updates].reverse()) {
      if (update.message?.chat?.id) {
        cachedChatId = update.message.chat.id;
        console.log(`[Telegram] Dinamik chat ID bulundu: ${cachedChatId}`);
        return cachedChatId;
      }
    }
  } catch (err) {
    console.error("[Telegram] Updates çekilirken hata oluştu:", err.message);
  }
  return null;
}

/**
 * Belirtilen HTML formatındaki mesajı Telegram sahibine gönderir.
 * @param {string} text - Gönderilecek HTML formatındaki mesaj içeriği
 */
async function sendTelegramAlert(text) {
  if (!TELEGRAM_TOKEN) {
    console.warn("[Telegram] Token yapılandırılmamış.");
    return false;
  }

  const chatId = await getTelegramChatId();
  if (!chatId) {
    console.warn("[Telegram] Gönderim başarısız: Aktif chat ID bulunamadı. Lütfen önce Telegram botunuza (/start) mesajı gönderin.");
    return false;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    });
    console.log(`[Telegram] Bildirim başarıyla gönderildi. Chat ID: ${chatId}`);
    return true;
  } catch (err) {
    console.error("[Telegram] Mesaj gönderim hatası:", err.response?.data || err.message);
    return false;
  }
}

let lastUpdateId = 0;
let isPollingActive = false;

async function handleTelegramMessage(client, message) {
  const text = message.text;
  const chatId = message.chat.id;
  
  if (!text) return;
  
  // Eğer henüz cache edilmemişse ve ilk kez yazıyorsa veya token/id eşleşiyorsa
  if (!cachedChatId) {
    cachedChatId = chatId;
    console.log(`[Telegram] İlk chat ID önbelleğe alındı: ${cachedChatId}`);
  }
  
  // Sadece yetkili chat ID'sine yanıt ver
  if (cachedChatId && String(chatId) !== String(cachedChatId)) {
    console.log(`[Telegram Chat] Yetkisiz chat ID yoksayıldı: ${chatId}`);
    return;
  }
  
  console.log(`[Telegram Chat] Mesaj alındı: "${text}"`);
  
  try {
    // ── SUNUCU CONTEXT BİLGİSİ ──
    const Ticket = require("../../models/Ticket");
    const StaffProgress = require("../../models/StaffProgress");
    const { nightModePendingBans } = require("./discordAbuseDetector");
    
    // 1. Voice Üyeleri
    let activeVoiceUsers = 0;
    try {
      for (const guild of client.guilds.cache.values()) {
        activeVoiceUsers += guild.members.cache.filter(m => m.voice.channel).size;
      }
    } catch (_) {}
    
    // 2. Açık Destek Biletleri
    let openTicketsCount = 0;
    try {
      openTicketsCount = (await Ticket.find({ status: "open" })).length;
    } catch (_) {}
    
    // 3. Aktif Yetkililer
    let activeStaffCount = 0;
    try {
      activeStaffCount = (await StaffProgress.find({ status: "active" })).length;
    } catch (_) {}
    
    // 4. Bekleyen Abuse / Sabotaj Şüpheleri
    let pendingAbuseCount = 0;
    try {
      if (nightModePendingBans) {
        pendingAbuseCount = nightModePendingBans.size;
      }
    } catch (_) {}
    
    // 5. Son 10 Dakikadaki Chat Aktifliği
    const recentMsgs = getRecentMessageCount();
    
    let activityDesc = "Sakin / Düşük Aktiflik";
    if (recentMsgs > 50 || activeVoiceUsers > 10) {
      activityDesc = "Çok Aktif / Hararetli Sohbet Var";
    } else if (recentMsgs > 10 || activeVoiceUsers > 3) {
      activityDesc = "Orta Seviye Aktiflik";
    }
    
    let abuseDesc = pendingAbuseCount > 0 
      ? `🚨 DİKKAT: Sistemde şu anda aktif olarak tespit edilen ${pendingAbuseCount} şüpheli işlem / abuse bulunuyor!` 
      : "✅ Sunucuda şu an herhangi bir abuse şüphesi veya kural ihlali bulunmuyor.";

    const systemPrompt = `Sen Sentara sunucu yönetim yapay zeka asistanısın.
Bu konuşma Telegram botu üzerinden sistem yöneticisi ile yapılmaktadır.
Sana sunucunun güncel durumu, aktifliği ve abuse tespit raporları canlı olarak verilir. Bu bilgilere dayanarak yöneticinin sorularını detaylı, profesyonel ve doğru şekilde cevapla.

GÜNCEL SUNUCU BİLGİLERİ:
- Sunucu Aktiflik Durumu: ${activityDesc}
- Sesteki Aktif Üye Sayısı: ${activeVoiceUsers}
- Son 10 Dakikada Gönderilen Mesaj Sayısı: ${recentMsgs}
- Açık Destek Biletleri (Tickets): ${openTicketsCount}
- Aktif Yetkili Sayısı (Staff): ${activeStaffCount}
- Abuse/Şüpheli İşlem Durumu: ${abuseDesc}

Kurallar:
- Türkçe cevap ver.
- Canlı istatistikleri ve durumu yöneticinin sorusuna uygun şekilde netçe paylaş.
- Yöneticinin sorduğu sorulara göre sunucunun durumunu (insanlar sohbet ediyor mu, aktiflik var mı, abuse var mı vb.) yukarıdaki verilere dayanarak cevapla.`;

    const { chatWithAI } = require("./aiService");
    const response = await chatWithAI([{ role: "user", content: text }], systemPrompt);
    
    await sendTelegramAlert(response);
  } catch (err) {
    console.error("[Telegram Chat] AI Hata:", err.message);
    await sendTelegramAlert(`❌ Yapay zeka yanıt verirken hata oluştu: ${err.message}`);
  }
}

function startTelegramPolling(client) {
  if (isPollingActive) return;
  if (!TELEGRAM_TOKEN) {
    console.warn("[Telegram Polling] Token yapılandırılmamış, polling başlatılmadı.");
    return;
  }
  
  isPollingActive = true;
  console.log("[Telegram] Polling dinleyici başlatıldı.");

  // Delete webhook first to avoid 409 Conflict errors
  axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook`)
    .then(() => {
      console.log("[Telegram] Webhook silindi (polling aktif).");
    })
    .catch((err) => {
      console.warn("[Telegram] Webhook silinirken hata (yok sayılabilir):", err.message);
    });

  async function poll() {
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`,
        { timeout: 20000 }
      );
      const updates = response.data?.result || [];
      for (const update of updates) {
        lastUpdateId = update.update_id;
        if (update.message) {
          await handleTelegramMessage(client, update.message);
        }
      }
    } catch (err) {
      // Normal timeouts are ignored to avoid spamming console
      if (!err.message?.includes("timeout")) {
        console.error("[Telegram Polling] Hata:", err.message);
      }
    }
    // Her 3 saniyede bir yeni mesajları sorgula
    setTimeout(poll, 3000);
  }

  poll();
}

module.exports = { 
  sendTelegramAlert,
  recordMessage,
  startTelegramPolling
};
