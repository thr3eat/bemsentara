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
  try {
    if (global.lastInteraction) {
      const { sendErrorReplyWithButton } = require("./bot/services/errorReporter");
      const err = reason instanceof Error ? reason : new Error(String(reason));
      sendErrorReplyWithButton(global.lastInteraction, err, "Process Unhandled Rejection").catch(() => {});
    }
  } catch (_) {}
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception thrown:", error);
  try {
    if (global.lastInteraction) {
      const { sendErrorReplyWithButton } = require("./bot/services/errorReporter");
      sendErrorReplyWithButton(global.lastInteraction, error, "Process Uncaught Exception").catch(() => {});
    }
  } catch (_) {}
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
    discordBot.once("ready", async () => {
      logger.success(`Discord bot başlatıldı: ${discordBot.user.tag}`);
      
      const { LOG_CHANNEL_ID } = require("./config");
      const { EmbedBuilder } = require("discord.js");
      try {
        const channel = await discordBot.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(0x7c6af7)
            .setTitle("⚙️ BOT YENİDEN BAŞLATMA SİHİRBAZI")
            .setDescription("Bot yeniden başlatılıyor ⏳\nLütfen 15 saniye bekleyin... Aktarılıyorsunuz.")
            .setFooter({ text: "Eko Yıldız • Sistem Başlatıcı" })
            .setTimestamp();
            
          const msg = await channel.send({ embeds: [embed] }).catch(() => null);
          if (msg) {
            setTimeout(async () => {
              const successEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle("✅ BOT BAŞARIYLA YENİDEN BAŞLATILDI")
                .setDescription("🚀 Bot tüm sistemleri başarıyla yükledi ve aktif hale getirildi.")
                .setFooter({ text: "Eko Yıldız • Sistem Başlatıcı" })
                .setTimestamp();
              await msg.edit({ embeds: [successEmbed] }).catch(() => {});
            }, 15000);
          }
        }
      } catch (err) {
        logger.error("[index] Startup message error:", err.message);
      }
    });

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
