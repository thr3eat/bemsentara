'use strict';

const axios = require("axios");
const fs = require("fs");
const path = require("path");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8906443471:AAHWNkdq4kMrLsVD-GwySfOXEcLWpKDcUZU";
let cachedChatId = process.env.TELEGRAM_CHAT_ID || "8683506546";

const recentMessages = []; // Timestamps of recent messages

// Instance lock management
const LOCK_FILE = path.join(__dirname, "../../data/.telegram_polling.lock");
const LOCK_TIMEOUT = 30000; // 30 seconds - if lock is older than this, assume process died

function createLockFile() {
  try {
    if (!fs.existsSync(path.dirname(LOCK_FILE))) {
      fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
    }
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
      instance: process.env.INSTANCE_ID || "default"
    }, null, 2));
    console.log("[Telegram Polling] Lock dosyası oluşturuldu (PID: " + process.pid + ")");
    return true;
  } catch (err) {
    console.error("[Telegram Polling] Lock dosyası oluşturulamadı:", err.message);
    return false;
  }
}

function updateLockFile() {
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now(),
      instance: process.env.INSTANCE_ID || "default"
    }, null, 2));
  } catch (err) {
    console.error("[Telegram Polling] Lock dosyası güncellenemedi:", err.message);
  }
}

function isLockValid() {
  try {
    if (!fs.existsSync(LOCK_FILE)) {
      return false;
    }
    const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
    const age = Date.now() - lockData.timestamp;
    
    // If lock is older than timeout, consider it stale
    if (age > LOCK_TIMEOUT) {
      console.log("[Telegram Polling] Eski lock dosyası tespit edildi, üzerine yazılıyor...");
      return false;
    }
    
    // If lock is from same PID, it's still valid
    if (lockData.pid === process.pid) {
      return true;
    }
    
    console.warn(`[Telegram Polling] ⚠️ BAŞKA BİR ÖRNEK ZATEN ÇOK GÜÇLÜDENİCİ! PID: ${lockData.pid}, Örnek: ${lockData.instance}`);
    return true;
  } catch (err) {
    console.error("[Telegram Polling] Lock dosyası okunamadı:", err.message);
    return false;
  }
}

function removeLockFile() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
      console.log("[Telegram Polling] Lock dosyası silindi");
    }
  } catch (err) {
    console.error("[Telegram Polling] Lock dosyası silinemedi:", err.message);
  }
}

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
    if (err.response?.status === 409) {
      console.warn("[Telegram] Chat ID sorgulanırken 409 çakışması algılandı, webhook siliniyor...");
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook?drop_pending_updates=true`).catch(() => {});
    } else {
      console.error("[Telegram] Updates çekilirken hata oluştu:", err.message);
    }
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

let consecutive409s = 0;
let pollingTimeout = null;
let isAttemptingRecovery = false;

async function startTelegramPolling(client) {
  if (isPollingActive) return;
  
  const pollingEnabled = process.env.TELEGRAM_POLLING_ENABLED !== "false";
  if (!pollingEnabled) {
    console.log("[Telegram Polling] Telegram polling .env veya ortam değişkenleri üzerinden devre dışı bırakıldı.");
    return;
  }

  if (!TELEGRAM_TOKEN) {
    console.warn("[Telegram Polling] Token yapılandırılmamış, polling başlatılmadı.");
    return;
  }
  
  // Check if another instance is already polling
  if (isLockValid() && process.pid.toString() !== (function() {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8"));
      return lockData.pid.toString();
    } catch { return process.pid.toString(); }
  })()) {
    console.error("❌ [Telegram Polling] BAŞKA BİR ÖRNEK ZATEN POLLİNG YAPIYOR!");
    console.error("❌ Telegram Polling DEVRE DIŞI BIRAKILDI.");
    console.error("💡 İpucu: Eğer bu bot yerel geliştirmede çalışıyorsa ve üretim sunucusunda başka bir örnek varsa, .env dosyasına TELEGRAM_POLLING_ENABLED=false ekleyebilirsiniz.");
    return;
  }
  
  isPollingActive = true;
  
  // Create lock file
  if (!createLockFile()) {
    console.error("❌ [Telegram Polling] Lock dosyası oluşturulamadı, polling başlatılmıyor.");
    isPollingActive = false;
    return;
  }
  
  console.log("[Telegram Polling] ✅ Polling dinleyici başlatılıyor...");

  // Delete webhook first to avoid 409 Conflict errors
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook?drop_pending_updates=true`);
    console.log("[Telegram Polling] ✅ Webhook silindi (polling aktif).");
  } catch (err) {
    console.warn("[Telegram Polling] Webhook silinirken hata:", err.message);
  }

  // Cleanup on process exit
  process.on("SIGTERM", () => removeLockFile());
  process.on("SIGINT", () => removeLockFile());

  async function poll() {
    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`,
        { timeout: 20000 }
      );
      
      consecutive409s = 0; // Reset counter on successful update
      isAttemptingRecovery = false;
      updateLockFile(); // Keep lock fresh
      
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
        if (err.response?.status === 409) {
          consecutive409s++;
          const description = err.response?.data?.description || "";
          
          if (description.toLowerCase().includes("webhook")) {
            console.warn("[Telegram Polling] ⚠️ Webhook çakışması algılandı, webhook siliniyor...");
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteWebhook?drop_pending_updates=true`).catch(() => {});
          } else {
            if (!isAttemptingRecovery) {
              console.warn(`[Telegram Polling] ⚠️ 409 Çakışma Hatası: ${description}`);
              console.warn("⚠️ Telegram botunuz başka bir yerde (örneğin başka bir terminal, sunucu veya geliştirici bilgisayarı) çalışıyor olabilir!");
              isAttemptingRecovery = true;
            }
          }

          if (consecutive409s >= 10) {
            console.error("❌ [Telegram Polling] Üst üste 10 kez çakışma (409) hatası alındı.");
            console.error("❌ Çakışmaları ve log kirliliğini önlemek amacıyla Telegram Polling bu oturum için KAPATILDI.");
            console.error("💡 Botun başka bir yerde çalışıp çalışmadığını kontrol edin. .env'den TELEGRAM_POLLING_ENABLED=false ekleyebilirsiniz.");
            removeLockFile();
            isPollingActive = false;
            return; // Exit polling loop entirely
          }

          // Exponential backoff: 5s, 10s, 15s, 20s, 25s (max 25s)
          const backoffDelay = Math.min(5000 + (consecutive409s * 2500), 25000);
          console.warn(`[Telegram Polling] ⏱️ ${backoffDelay}ms içinde yeniden denenecek... (Çakışma Sayısı: ${consecutive409s}/10)`);
          pollingTimeout = setTimeout(poll, backoffDelay);
          return;
        } else {
          console.error("[Telegram Polling] Hata:", err.message);
        }
      }
    }
    // Her 3 saniyede bir yeni mesajları sorgula
    pollingTimeout = setTimeout(poll, 3000);
  }

  poll();
}

function stopTelegramPolling() {
  if (pollingTimeout) {
    clearTimeout(pollingTimeout);
    pollingTimeout = null;
  }
  removeLockFile();
  isPollingActive = false;
  console.log("[Telegram Polling] Polling durduruldu");
}

/**
 * Telegram üzerinden sesli arama başlatır (CallMeBot kullanarak)
 */
async function callTelegramUser(text) {
  const username = process.env.TELEGRAM_USERNAME || "8683506546"; // Kullanıcının Telegram kullanıcı adı veya ID'si (.env'den okunacak)
  if (!username) {
    console.warn("[Telegram Call] Arama başarısız: TELEGRAM_USERNAME tanımlanmamış.");
    return false;
  }
  try {
    const formattedUsername = (username.startsWith("@") || /^\d+$/.test(username)) ? username : `@${username}`;
    // tr-TR voice for Turkish text reading
    const url = `https://api.callmebot.com/start.php?user=${formattedUsername}&text=${encodeURIComponent(text)}&lang=tr-TR-Standard-A`;
    await axios.get(url);
    console.log(`[Telegram Call] Arama tetiklendi: ${formattedUsername}`);
    return true;
  } catch (err) {
    console.error("[Telegram Call] Arama başlatılırken hata oluştu:", err.message);
    return false;
  }
}

module.exports = { 
  sendTelegramAlert,
  recordMessage,
  startTelegramPolling,
  stopTelegramPolling,
  callTelegramUser
};
