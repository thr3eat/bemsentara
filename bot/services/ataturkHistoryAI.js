const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { chatWithAI } = require("./aiService");

const TARGET_CHANNEL_ID = "1514583020680777760";

/**
 * Wikimedia Commons üzerinden rastgele Atatürk fotoğrafı çeker.
 */
async function randomAtaturkPhoto() {
  const BASE = 'https://commons.wikimedia.org/w/api.php';

  // 1. Listeyi çek
  const listRes = await axios.get(
    `${BASE}?action=query&list=categorymembers` +
    `&cmtitle=Category:Photographs_of_Mustafa_Kemal_Atat%C3%BCrk` +
    `&cmlimit=500&cmtype=file&format=json&origin=*`
  );
  
  const files = listRes.data.query.categorymembers;
  if (!files || files.length === 0) {
    throw new Error("Wikimedia'dan fotoğraf listesi alınamadı.");
  }

  // 2. Rastgele seç
  const file = files[Math.floor(Math.random() * files.length)];

  // 3. URL'yi al
  const imgRes = await axios.get(
    `${BASE}?action=query&titles=${encodeURIComponent(file.title)}` +
    `&prop=imageinfo&iiprop=url&format=json&origin=*`
  );
  
  const pages = imgRes.data.query.pages;
  const url = Object.values(pages)[0].imageinfo[0].url;

  return url;
}

/**
 * Her gün sabah 09:00'da Atatürk ile ilgili tarihi bilgi atar.
 * @param {import('discord.js').Client} client
 */
function startAtaturkHistoryScheduler(client) {
  // Her gün sabah saat 09:00'da çalışır
  cron.schedule("0 9 * * *", async () => {
    try {
      console.log("🕒 [AtaturkHistoryAI] Günlük görev başlatılıyor...");
      await postAtaturkHistory(client);
    } catch (err) {
      console.error("❌ [AtaturkHistoryAI] Cron hatası:", err);
    }
  });
}

/**
 * AI'dan bilgi alıp kanala gönderir.
 * Manuel test etmek için dışarıya da açıldı.
 * @param {import('discord.js').Client} client
 */
async function postAtaturkHistory(client) {
  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn("⚠️ [AtaturkHistoryAI] Hedef kanal bulunamadı veya metin kanalı değil:", TARGET_CHANNEL_ID);
      return;
    }

    const today = new Date();
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const dateStr = `${today.getDate()} ${months[today.getMonth()]}`;

    const systemPrompt = "Sen saygın bir tarihçisin. Sadece Mustafa Kemal Atatürk'ün hayatı hakkında net ve doğru bilgiler verirsin.";
    const userPrompt = `Bugün ${dateStr}. Tarihte bugün (veya bu haftalarda) Mustafa Kemal Atatürk ne yapmıştı? Kısa, anlaşılır ve saygılı bir dille 1-2 paragraf halinde anlat. Hiçbir başlık, selamlama veya "Tarihte bugün" gibi giriş kelimeleri kullanma, doğrudan olayı anlat.`;

    let aiContent = "";
    try {
      aiContent = await chatWithAI([{ role: 'user', content: userPrompt }], systemPrompt);
    } catch (aiErr) {
      console.error("❌ [AtaturkHistoryAI] AI isteği başarısız:", aiErr.message);
      aiContent = `${dateStr} gününde Atatürk'ün tarihimize kattığı eşsiz değerleri saygıyla anıyoruz. (Yapay zeka servisinde anlık bir sorun oluştu)`;
    }

    // API'den rastgele fotoğraf çek
    let randomPhoto = "https://upload.wikimedia.org/wikipedia/commons/e/e0/Mustafa_Kemal_Atat%C3%BCrk_in_1932.jpg"; // Fallback
    try {
      randomPhoto = await randomAtaturkPhoto();
    } catch (apiErr) {
      console.error("❌ [AtaturkHistoryAI] Fotoğraf API isteği başarısız:", apiErr.message);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📅 Tarihte Bugün - ${dateStr}`)
      .setDescription(aiContent)
      .setColor(0xdc143c) // Kırmızı
      .setImage(randomPhoto)
      .setFooter({ text: "TMT Yapay Zeka Tarih Sistemi", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`✅ [AtaturkHistoryAI] ${dateStr} mesajı başarıyla gönderildi.`);
  } catch (error) {
    console.error("❌ [AtaturkHistoryAI] Mesaj gönderim hatası:", error);
  }
}

module.exports = {
  startAtaturkHistoryScheduler,
  postAtaturkHistory
};
