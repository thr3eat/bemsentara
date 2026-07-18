const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

// Apply global sanitization to prevent @everyone / @here pings from bot messages
try {
  const applyDisable = require('./bot/patches/disableEveryone');
  applyDisable();
} catch (err) {
  console.error('[startup] disableEveryone patch failed:', err && err.message);
}

const mongoose = require("mongoose");
mongoose.set("bufferCommands", false);

const app = require("./server/app");
const { createDiscordClient } = require("./bot/client");
const { initializeDiscordHandlers } = require("./bot/handlers");
const { registerAllCommands } = require("./bot/registerCommands");
const { PORT, BASE_URL, TOKEN } = require("./config");
const path = require("path");
const cron = require("node-cron");
const axios = require("axios");

const logger = require("./utils/logger");

const discordBot = createDiscordClient();

discordBot.on("debug", (info) => {
  if (typeof info === 'string') {
    if (
      info.includes('Heartbeat acknowledged') ||
      info.includes('WS => Shard') ||
      info.includes('WS => Manager') ||
      info.includes('Session Limit Information') ||
      info.includes('Fetched Gateway Information') ||
      info.includes('Failed to find guild, or unknown type for channel')
    ) {
      return;
    }
  }
  logger.info(`[Discord] ${info}`);
});
discordBot.on("warn", (info) => {
  logger.warn(`[Discord Warn] ${info}`);
});
discordBot.on("error", (err) => {
  logger.error(`[Discord Error]`, err);
});

const { setDiscordClient } = require("./bot/discordClient");
setDiscordClient(discordBot);
initializeDiscordHandlers(discordBot);

const discordLogger = require("./bot/services/discordLogger");
discordBot.once("ready", async () => {
  await discordLogger.init(discordBot);

  try {
    const { sendNotificationPermissionPrompt } = require("./utils/notification");
    await sendNotificationPermissionPrompt(discordBot);
  
    // --- v7.0 one-time release announcement and small reward ---
    try {
      const { appMeta, users } = require("./models/Store");
      const Economy = require("./models/Economy");
      const { LOG_CHANNEL_ID, EKOYILDIZ_MOD_LOG_CHANNEL_ID } = require("./config");

      const flag = appMeta.findOne({ key: "release_v7_0_announced" });
      if (!flag) {
        let sentAny = false;
        const channelsToNotify = [LOG_CHANNEL_ID, EKOYILDIZ_MOD_LOG_CHANNEL_ID];

        for (const chanId of channelsToNotify) {
          if (!chanId) continue;
          const ch = await discordBot.channels.fetch(chanId).catch(() => null);
          if (ch && typeof ch.send === "function") {
            try {
              const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
              const embed = new EmbedBuilder()
                .setColor(0x7c6af7)
                .setTitle('📣 Sürüm v7.0 — Yeni Özellikler ve Güncellemeler (v6.0 tarzı duyuru)')
                .setDescription('Merhaba EkoYıldız topluluğu! 🎉\nv7.0 sürümümüz yayımlandı. Bu sürümde topluluk ve moderasyon için kapsamlı yenilikler getiriyoruz — daha etkili bordro sistemi, resmi istifa süreci, vaka raporu entegrasyonu, AI destekli denetim, PIP, vardiya devir notları ve çok daha fazlası.')
                .addFields(
                  { name: '🔹 1) Dinamik Bordro & Vergi Kesintisi', value: 'Yetkili maaşları otomatik hesaplanır; disiplin durumuna göre kesintiler uygulanır.', inline: false },
                  { name: '🔹 2) Resmi İstifa & Kıdem Tazminatı', value: '3 günlük ihbar süreci, yönetim incelemesi ve kıdem tazminatı hesaplama (60+ gün).', inline: false },
                  { name: '🔹 3) Vaka Raporu ve Delil Klasörü', value: 'Otomatik `CASE-XXXX` ID, denetçi etkileşimleri ve kanıt arşivleme.', inline: false },
                  { name: '🔹 4) Vardiya Devir & AI Denetimi', value: 'Devir notları kaydedilir, AI anomali tespiti ile şüpheli durumlar raporlanır.', inline: false },
                  { name: '🔹 5) Burnout Tespiti ve Zorunlu İzin', value: 'Uzun görev yapanlara otomatik zorunlu dinlenme (kahve izni).', inline: false },
                  { name: '🔹 6) Taktik Komuta & Operasyon Masası', value: 'Canlı durum panosu ve komuta butonları ile hızlı çağrı ve ödül verme.', inline: false },
                  { name: '🔹 7) Personel 2FA', value: 'Kritik işlemler için DM üzerinden 2FA doğrulaması (5 dk geçiş).', inline: false },
                  { name: '🔹 8) PIP — Performans İyileştirme Planı', value: 'Uyarı alan personele son şans: iki kat görev hedefi ve takip.', inline: false },
                  { name: '🔹 9) Birim Lojistiği & Bütçe Yönetimi', value: 'UnitBudget ile prim dağıtımı, izin kredileri ve birim reklamları.', inline: false },
                  { name: '🔹 10) Disiplin Soruşturması & İtiraz Mahkemesi', value: 'Disiplin süreçleri şeffaf ve itiraza açık biçimde yürütülür.', inline: false }
                )
                .setFooter({ text: 'Eko Yıldız • Sürüm v7.0 — Küçük jest: +25 EkoCoin (tek seferlik)' })
                .setTimestamp();

              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Detaylı Güncelleme (Panel)').setStyle(5).setURL(`${BASE_URL}/dashboard`)
              );

              await ch.send({ embeds: [embed], components: [row] });
              sentAny = true;
            } catch (err) {
              logger.error(`[Release v7.0] Channel ${chanId} send error:`, err.message);
            }
          }
        }

        // distribute small reward to staff users & send DM announcements
        try {
          const StaffProgress = require("./models/StaffProgress");
          const staffList = await StaffProgress.find({ status: "active" });

          const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require('discord.js');
          const dmEmbed = new EmbedBuilder()
            .setColor(0x7c6af7)
            .setTitle('📣 Sürüm v7.0 — Yeni Özellikler ve Güncellemeler')
            .setDescription('Merhaba Değerli Yetkilimiz! 🎉\nv7.0 sürümümüz başarıyla yayına alındı. Bu güncelleme ile sistemimize yepyeni gerçekçi kurumsal özellikler eklendi:')
            .addFields(
              { name: '🔹 1) Dinamik Bordro & Vergi Kesintisi', value: 'Maaşlar artık haftalık aktiflik, ticket ve ses sürenize göre hesaplanıyor.', inline: false },
              { name: '🔹 2) Resmi İstifa & Kıdem Tazminatı', value: '3 günlük ihbar süresi ve kıdem tazminatı (60+ gün aktiflik) sistemi getirildi.', inline: false },
              { name: '🔹 3) Vaka Raporu ve Delil Arşivi', value: '`CASE-XXXX` ID formatında delil dosyaları ve kurul onay mekanizması.', inline: false },
              { name: '🔹 4) Vardiya Devir & AI Denetimi', value: 'Devir notları kaydediliyor ve yapay zeka ile denetleniyor.', inline: false },
              { name: '🔹 5) Mental Yorgunluk & Kahve İzni', value: 'Çok çalışan yetkililerimiz için zorunlu dinlenme ve kahve izni modu.', inline: false },
              { name: '🔹 6) Taktik Operasyon Masası', value: 'Canlı ekip paneli, nöbete çağırma telsiz duyuruları ve lider seçimi.', inline: false },
              { name: '🔹 7) Personel 2FA', value: 'Kritik sicil ve yetkili işlemlerinden önce butonlu DM doğrulaması.', inline: false },
              { name: '🔹 8) Performans İyileştirme Planı (PIP)', value: 'Hedeflerin gerisinde kalan yetkililere son şans hedefleri.', inline: false },
              { name: '🔹 9) Birim Lojistiği & Bütçe Yönetimi', value: 'Ortak havuzdan prim dağıtma ve izin kredisi satın alma.', inline: false },
              { name: '🔹 10) Disiplin Mahkemesi & İhbar Hattı', value: 'Savunma yapma hakları ve SHA-256 şifreli çift yönlü ihbar tüneli.', inline: false }
            )
            .setFooter({ text: 'Eko Yıldız • Sürüm v7.0 — Küçük jest: +25 EkoCoin (tek seferlik)' })
            .setTimestamp();

          const dmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Web Paneline Git').setStyle(5).setURL(`${BASE_URL}/dashboard`)
          );

          for (const u of staffList) {
            // Distribute reward in Economy
            try {
              let eco = await Economy.findOne({ userId: String(u.userId) });
              if (!eco) {
                eco = new Economy({ userId: String(u.userId), balance: 0, totalEarned: 0 });
              }
              eco.balance = (eco.balance || 0) + 25;
              eco.totalEarned = (eco.totalEarned || 0) + 25;
              await eco.save();
            } catch (ecoErr) {
              console.error(`Economy reward error for ${u.userId}:`, ecoErr.message);
            }

            // Send DM
            try {
              const discordUser = await discordBot.users.fetch(u.userId).catch(() => null);
              if (discordUser) {
                await discordUser.send({ embeds: [dmEmbed], components: [dmRow] }).catch(() => {});
                sentAny = true;
              }
            } catch (dmErr) {
              console.warn(`Could not send release announcement DM to ${u.userId}:`, dmErr.message);
            }
          }
        } catch (err) {
          logger.error("Staff reward/announcement loop error:", err.message);
        }

        // mark announced to prevent duplicate spam on reboots
        appMeta.create({ key: "release_v7_0_announced", value: true, createdAt: new Date() });
        const { saveStoreNow } = require("./models/Store");
        saveStoreNow();
      }
    } catch (releaseErr) {
      logger.error("[Release v7.0] Announcement error:", releaseErr.message);
    }
  } catch (promptErr) {
    logger.error("[NotificationPrompt] Startup prompt error:", promptErr.message);
  }
});

cron.schedule("*/14 * * * *", async () => {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    logger.info(`Self-ping OK`);
  } catch (e) {
    logger.warn("Self-ping failed:", e.message);
  }
});

async function start() {
  try {
    logger.section("BOT STARTUP");
    logger.step(`Node.js sürümü: ${process.version}`);
    logger.step(`Token hazır: ${!!TOKEN}`);

    const { initStore, saveStoreNow } = require("./models/Store");
    logger.step("Veri deposu yükleniyor...");
    const counts = await initStore();
    const { STORE_FILE } = require("./models/persistence");
    const { isMongoActive } = require("./models/db");
    const storageBackend = isMongoActive() ? "MongoDB" : `Dosya → ${STORE_FILE}`;
    logger.success(
      `Veri deposu hazır [${storageBackend}]: ${counts.users} kullanıcı, ${counts.tickets} ticket, ${counts.wikiArticles} wiki`
    );

    // ── DATABASE RESTORE TRIGGER (TEMPORARY) ──
    try {
      const StaffProgress = require("./models/StaffProgress");
      const result = await StaffProgress.updateMany(
        {
          status: 'dismissed',
          dismissReason: 'Discord üzerinde yetkili rolünün bulunmaması veya sunucudan çıkılması (Otomatik Senkronizasyon)'
        },
        {
          $set: {
            status: 'active',
            dismissedAt: null,
            dismissReason: null
          }
        }
      );
      logger.success(`[TEMPORARY RESTORE] ${result.modifiedCount} personel tekrar aktif duruma getirildi.`);
    } catch (restoreErr) {
      logger.error("[TEMPORARY RESTORE] Error:", restoreErr.message);
    }

    process.on("SIGINT", () => {
      console.log("\n[Telegram Polling] SIGINT alındı, Telegram Polling temizleniyor...");
      try {
        const { stopTelegramPolling } = require("./bot/services/telegramService");
        stopTelegramPolling();
      } catch (err) {
        console.error("[Telegram Polling] Cleanup hatası:", err.message);
      }
      saveStoreNow();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("[Telegram Polling] SIGTERM alındı, Telegram Polling temizleniyor...");
      try {
        const { stopTelegramPolling } = require("./bot/services/telegramService");
        stopTelegramPolling();
      } catch (err) {
        console.error("[Telegram Polling] Cleanup hatası:", err.message);
      }
      saveStoreNow();
      process.exit(0);
    });

    // 1. Express sunucusunu hemen başlat (Render port binding algılaması için)
    logger.section("WEB SERVER");
    app.listen(PORT, () => {
      logger.success(`Sunucu hazır: ${BASE_URL}`);
      logger.info(`Ticket sistemi port ${PORT} üzerinde dinleniyor`);
    });

    logger.section("DISCORD CONNECTION");

    const connectDiscord = async () => {
      const MAX_RETRIES = 5;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.step(`[Discord] Deneme ${attempt}/${MAX_RETRIES}`);
          await discordBot.login(TOKEN);
          logger.success("Discord bot bağlandı ve aktif.");
          await new Promise(r => setTimeout(r, 1000));
          await registerAllCommands();
          return; // başarılı → çık
        } catch (err) {
          // Rate limit hatası — retryAfter ms bekle
          const retryAfterMs = err.retryAfter ?? err.sublimitTimeout ?? null;
          if (retryAfterMs && attempt < MAX_RETRIES) {
            const waitSec = Math.ceil(retryAfterMs / 1000);
            logger.warn(`[Discord] Rate limit: ${waitSec} saniye bekleniyor (deneme ${attempt}/${MAX_RETRIES})...`);
            await new Promise(r => setTimeout(r, retryAfterMs + 2000)); // +2s tampon
            // Yeniden bağlanmak için yeni client oluştur (destroy sonrası gerekli)
            discordBot.destroy().catch(() => {});
            await new Promise(r => setTimeout(r, 500));
          } else {
            logger.error(`[Discord] Login başarısız (deneme ${attempt}/${MAX_RETRIES}):`, err.message);
            logger.error("Full stack:", err.stack);
            if (attempt >= MAX_RETRIES) {
              logger.error("[Discord] Maksimum deneme sayısına ulaşıldı. Web sunucusu aktif kalmaya devam ediyor.");
            }
          }
        }
      }
    };

    connectDiscord();
  } catch (err) {
    logger.error("Başlatma hatası:", err);
    process.exit(1);
  }
}

start();
