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
  // Tüm debug mesajlarını logla (gateway bağlantı sorununu bulmak için)
  logger.info(`[Discord Debug] ${info}`);
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
    const { initStore, saveStoreNow } = require("./models/Store");
    const counts = await initStore();
    const { STORE_FILE } = require("./models/persistence");
    const { isMongoActive } = require("./models/db");
    const storageBackend = isMongoActive() ? "MongoDB" : `Dosya → ${STORE_FILE}`;
    logger.success(
      `Veri deposu yüklendi [${storageBackend}]: ${counts.users} kullanıcı, ${counts.tickets} ticket, ${counts.wikiArticles} wiki`
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
      logger.success(`[TEMPORARY RESTORE] Restored ${result.modifiedCount} staff members back to active.`);
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
    app.listen(PORT, () => {
      logger.info(`Server: ${BASE_URL}`);
      logger.info(`Ticket Sistemi Aktif ve Port ${PORT} dinleniyor`);
    });

    // 2. Discord login — Rate limit durumunda otomatik bekle ve yeniden dene
    logger.info(`Node.js version: ${process.version}`);
    logger.info(`TOKEN exists: ${!!TOKEN}, length: ${TOKEN?.length}`);

    const connectDiscord = async () => {
      const MAX_RETRIES = 5;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          logger.info(`[Discord] Bağlantı denemesi ${attempt}/${MAX_RETRIES}...`);
          await discordBot.login(TOKEN);
          logger.success("Discord bot giriş isteği başarılı ve aktif.");
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
