const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const { chatWithAI } = require("./aiService");

const TARGET_CHANNEL_ID = "1393379303508541440";

/**
 * Her gün sabah 09:00'da tarih paylaşımı yapar.
 * @param {import('discord.js').Client} client
 */
function startEkoYildizHistoryScheduler(client) {
  // Her gün sabah saat 09:00'da çalışır
  cron.schedule("0 9 * * *", async () => {
    try {
      console.log("🕒 [EkoYildizHistoryAI] Günlük görev başlatılıyor...");
      await postEkoYildizHistory(client);
    } catch (err) {
      console.error("❌ [EkoYildizHistoryAI] Cron hatası:", err);
    }
  });
}

/**
 * AI'dan bilgi alıp kanala gönderir.
 * Manuel test etmek için dışarıya da açıldı.
 * @param {import('discord.js').Client} client
 */
async function postEkoYildizHistory(client) {
  try {
    const channel = await client.channels.fetch(TARGET_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.warn("⚠️ [EkoYildizHistoryAI] Hedef kanal bulunamadı veya metin kanalı değil:", TARGET_CHANNEL_ID);
      return;
    }

    const today = new Date();
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const dateStr = `${today.getDate()} ${months[today.getMonth()]}`;

    const systemPrompt = "Sen saygın bir tarihçisin. Türk ve Dünya tarihi hakkında net ve doğru bilgiler verirsin.";
    const userPrompt = `Bugün ${dateStr}. Tarihte bugün (veya bu haftalarda) Türk veya dünya tarihinde yaşanan önemli bir tarihi olayı kısa, anlaşılır ve sürükleyici bir dille 1-2 paragraf halinde anlat. Hiçbir başlık, selamlama veya "Tarihte bugün" gibi giriş kelimeleri kullanma, doğrudan olayı anlat.`;

    let aiContent = "";
    try {
      aiContent = await chatWithAI([{ role: 'user', content: userPrompt }], systemPrompt);
    } catch (aiErr) {
      console.error("❌ [EkoYildizHistoryAI] AI isteği başarısız:", aiErr.message);
      aiContent = `${dateStr} gününde yaşanan tarihi gelişmeleri ve önemli olayları saygıyla hatırlıyoruz. (Yapay zeka servisinde anlık bir sorun oluştu)`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📅 Tarihte Bugün - ${dateStr}`)
      .setDescription(aiContent)
      .setColor(0xf39c12) // Turuncu / EkoYıldız temasına uygun
      .setFooter({ text: "EkoYıldız Yapay Zeka Tarih Sistemi", iconURL: client.user.displayAvatarURL() })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
    console.log(`✅ [EkoYildizHistoryAI] ${dateStr} mesajı başarıyla gönderildi.`);
  } catch (error) {
    console.error("❌ [EkoYildizHistoryAI] Mesaj gönderim hatası:", error);
  }
}

module.exports = {
  startEkoYildizHistoryScheduler,
  postEkoYildizHistory
};
