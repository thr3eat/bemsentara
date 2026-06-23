'use strict';

const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8906443471:AAHWNkdq4kMrLsVD-GwySfOXEcLWpKDcUZU";
let cachedChatId = process.env.TELEGRAM_CHAT_ID || "8683506546";

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

module.exports = { sendTelegramAlert };
