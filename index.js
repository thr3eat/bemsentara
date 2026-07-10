const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

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
      info.includes('Fetched Gateway Information')
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
