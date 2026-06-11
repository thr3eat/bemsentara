const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const { chatWithAI } = require("./aiService");

// Yüksek kaliteli tarihi Atatürk fotoğrafları (Gerçek linklerle değiştirilmeli/zenginleştirilmeli)
const ATATURK_PHOTOS = [
  "https://upload.wikimedia.org/wikipedia/commons/e/e0/Mustafa_Kemal_Atat%C3%BCrk_in_1932.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/4/46/Mustafa_Kemal_Atat%C3%BCrk_in_1923.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/c/c5/Mustafa_Kemal_Atat%C3%BCrk_in_1928.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/2/23/Mustafa_Kemal_Atat%C3%BCrk_on_the_balcony_of_the_Erzurum_Congress_building.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/7/77/Mustafa_Kemal_Atat%C3%BCrk_in_1938.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/e/ec/Gazi_Mustafa_Kemal_Pasha_in_1923.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/1/1b/Mustafa_Kemal_Atat%C3%BCrk_on_the_cover_of_Time_magazine%2C_1923.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/1/19/Atat%C3%BCrk_inspecting_troops.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/3/30/Atat%C3%BCrk_at_the_opening_of_the_Grand_National_Assembly_of_Turkey.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/d/d4/Atat%C3%BCrk_and_Ismet_Inonu.jpg"
];

const TARGET_CHANNEL_ID = "1514583020680777760";

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

    // Rastgele bir fotoğraf seç
    const randomPhoto = ATATURK_PHOTOS[Math.floor(Math.random() * ATATURK_PHOTOS.length)];

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
