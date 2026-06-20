const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const { chatWithAI } = require("./aiService");

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
    const day = today.getDate();
    const month = today.getMonth();
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const dateStr = `${day} ${months[month]}`;

    let title = `📅 Tarihte Bugün - ${dateStr}`;
    let embedColor = 0xdc143c; // Normal kırmızı
    const systemPrompt = "Sen saygın bir tarihçisin. Sadece Mustafa Kemal Atatürk'ün hayatı ve Türk tarihi hakkında net ve doğru bilgiler verirsin.";
    let userPrompt = `Bugün ${dateStr}. Tarihte bugün (veya bu haftalarda) Mustafa Kemal Atatürk ne yapmıştı? Kısa, anlaşılır ve saygılı bir dille 1-2 paragraf halinde anlat. Hiçbir başlık, selamlama veya "Tarihte bugün" gibi giriş kelimeleri kullanma, doğrudan olayı anlat.`;

    // Özel gün kontrolleri
    let isSpecialDay = false;
    let specialDayName = "";
    let isMourning = false; // 10 Kasım hüzün günü mü?

    if (month === 9 && day === 29) {
      isSpecialDay = true;
      specialDayName = "29 Ekim Cumhuriyet Bayramı";
    } else if (month === 4 && day === 19) {
      isSpecialDay = true;
      specialDayName = "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramı";
    } else if (month === 3 && day === 23) {
      isSpecialDay = true;
      specialDayName = "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı";
    } else if (month === 7 && day === 30) {
      isSpecialDay = true;
      specialDayName = "30 Ağustos Zafer Bayramı";
    } else if (month === 10 && day === 10) {
      isSpecialDay = true;
      isMourning = true;
      specialDayName = "10 Kasım Atatürk'ü Anma Günü";
    }

    if (isSpecialDay) {
      if (isMourning) {
        title = `🖤 ÖNEMLİ GÜN! - ${specialDayName} - ${dateStr}`;
        embedColor = 0x2c3e50; // Koyu Gri / Siyah tonu
        userPrompt = `Bugün ${specialDayName}. Ulu Önder Mustafa Kemal Atatürk'ün vefatının yıl dönümü. Bu hüzünlü, anlamlı ve önemli günde; Atatürk'ün hatırasını, fikirlerini, Türk milletine bıraktığı mirası ve onun ölümsüzlüğünü son derece saygılı, hürmetkar, duygusal ve derin bir dille 1-2 paragraf halinde anlat. Hiçbir başlık, selamlama veya giriş kelimesi kullanma, doğrudan anlatıma başla.`;
      } else {
        title = `🇹🇷 ÖNEMLİ GÜN! - ${specialDayName} - ${dateStr}`;
        embedColor = 0xff0000; // Canlı Kırmızı (Bayrak Kırmızısı)
        userPrompt = `Bugün ${specialDayName}! Türk milleti ve tarihi için son derece önemli, coşkulu, gurur dolu ve mutlu bir gün. Mustafa Kemal Atatürk'ün bu büyük gündeki rolünü, bu bayramın anlam ve önemini son derece coşkulu, mutlu, gururlu ve sürükleyici bir dille 1-2 paragraf halinde anlat. Hiçbir başlık, selamlama veya giriş kelimesi kullanma, doğrudan anlatıma başla.`;
      }
    }

    let aiContent = "";
    try {
      aiContent = await chatWithAI([{ role: 'user', content: userPrompt }], systemPrompt);
    } catch (aiErr) {
      console.error("❌ [AtaturkHistoryAI] AI isteği başarısız:", aiErr.message);
      if (isSpecialDay) {
        if (isMourning) {
          aiContent = `Bugün ${specialDayName}. Ulu Önderimiz Mustafa Kemal Atatürk'ü vefatının yıl dönümünde sonsuz sevgi, saygı, minnet ve özlemle anıyoruz. Fikirleri ve devrimleri her zaman yolumuzu aydınlatmaya devam edecek.`;
        } else {
          aiContent = `Bugün ${specialDayName}! Başta Ulu Önderimiz Mustafa Kemal Atatürk olmak üzere, bu vatanı bizlere armağan eden tüm kahramanlarımızı saygı, minnet ve coşkuyla anıyoruz. Bayramımız kutlu olsun!`;
        }
      } else {
        aiContent = `${dateStr} gününde Atatürk'ün tarihimize kattığı eşsiz değerleri saygıyla anıyoruz. (Yapay zeka servisinde anlık bir sorun oluştu)`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(aiContent)
      .setColor(embedColor)
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
