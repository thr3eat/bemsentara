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

// ── PROCESS ERROR HANDLERS (7/24 SELF-HEALING) ──
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception thrown:", error);
});

const discordBot = createDiscordClient();
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

    // Login and wait for ready
    await discordBot.login(TOKEN);
    logger.success("Discord bot başlatıldı");

    // Small delay to ensure bot is fully initialized
    await new Promise(r => setTimeout(r, 1000));

    // Then register commands
    await registerAllCommands();

    app.listen(PORT, () => {
      logger.info(`Server: ${BASE_URL}`);
      logger.info(`Ticket Sistemi Aktif`);
    });
  } catch (err) {
    logger.error("Başlatma hatası:", err);
    process.exit(1);
  }
}

start();
