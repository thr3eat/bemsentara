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

// ── ORTAM DEĞİŞKENİ DOĞRULAMASI ──
// Eksik bir config değeri yüzünden ileride belirsiz bir hatayla
// karşılaşmak yerine, en baştan net bir mesajla süreci durduruyoruz.
function validateEnv() {
  const missing = [];
  if (!TOKEN) missing.push("TOKEN");
  if (!BASE_URL) missing.push("BASE_URL");
  if (!PORT) missing.push("PORT");

  if (missing.length) {
    logger.error(`Eksik ortam değişkeni: ${missing.join(", ")}. Süreç başlatılamıyor.`);
    process.exit(1);
  }
}
validateEnv();

// ── PROCESS ERROR HANDLERS (7/24 SELF-HEALING) ──
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  try {
    if (global.lastInteraction) {
      const { sendErrorReplyWithButton } = require("./bot/services/errorReporter");
      const err = reason instanceof Error ? reason : new Error(String(reason));
      sendErrorReplyWithButton(global.lastInteraction, err, "Process Unhandled Rejection").catch(() => { });
    }
  } catch (_) { }
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception thrown:", error);
  try {
    if (global.lastInteraction) {
      const { sendErrorReplyWithButton } = require("./bot/services/errorReporter");
      sendErrorReplyWithButton(global.lastInteraction, error, "Process Uncaught Exception").catch(() => { });
    }
  } catch (_) { }

  // Node'un kendi tavsiyesi: uncaughtException sonrası process state'i
  // güvenilmez hale gelmiş olabilir. Hatayı raporladıktan sonra süreci
  // temiz şekilde kapatıp Render/PM2 gibi bir process manager'ın
  // botu yeniden ayağa kaldırmasına izin veriyoruz. Böylece "self-healing"
  // gerçek anlamda sağlanmış oluyor; bozuk state ile sonsuza dek
  // yaşamaya devam etmiyoruz.
  setTimeout(() => process.exit(1), 1000);
});

const discordBot = createDiscordClient();
const { setDiscordClient } = require("./bot/discordClient");
setDiscordClient(discordBot);
initializeDiscordHandlers(discordBot);

let selfPingTask = null;

// ── GRACEFUL SHUTDOWN (ortak fonksiyon, kod tekrarını önler) ──
async function shutdown(signal) {
  console.log(`\n[Shutdown] ${signal} alındı, temizlik yapılıyor...`);

  try {
    if (selfPingTask) selfPingTask.stop();
  } catch (_) { }

  try {
    const { stopTelegramPolling } = require("./bot/services/telegramService");
    stopTelegramPolling();
  } catch (err) {
    console.error("[Telegram Polling] Cleanup hatası:", err.message);
  }

  try {
    const { saveStoreNow } = require("./models/Store");
    saveStoreNow();
  } catch (err) {
    console.error("[Store] Kaydetme hatası:", err.message);
  }

  try {
    if (discordBot && discordBot.destroy) {
      await discordBot.destroy();
      console.log("[Discord] Bağlantı düzgün şekilde kapatıldı.");
    }
  } catch (err) {
    console.error("[Discord] Kapatma hatası:", err.message);
  }

  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("[MongoDB] Bağlantı kapatıldı.");
    }
  } catch (err) {
    console.error("[MongoDB] Kapatma hatası:", err.message);
  }

  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function start() {
  try {
    const { initStore } = require("./models/Store");
    const counts = await initStore();
    const { STORE_FILE } = require("./models/persistence");
    const { isMongoActive } = require("./models/db");
    const storageBackend = isMongoActive() ? "MongoDB" : `Dosya → ${STORE_FILE}`;
    logger.success(
      `Veri deposu yüklendi [${storageBackend}]: ${counts.users} kullanıcı, ${counts.tickets} ticket, ${counts.wikiArticles} wiki`
    );

    // ── DATABASE RESTORE TRIGGER (TEMPORARY) ──
    // Sadece RUN_STAFF_RESTORE=true olduğunda çalışır, böylece bu tek
    // seferlik düzeltme her yeniden başlatmada (deploy, crash restart vb.)
    // sessizce tekrar tekrar tetiklenmez. İşlem bittikten sonra bu bloğu
    // ve ortam değişkenini kaldırabilirsin.
    if (process.env.RUN_STAFF_RESTORE === "true") {
      try {
        const StaffProgress = require("./models/StaffProgress");
        const result = await StaffProgress.updateMany(
          {
            status: "dismissed",
            dismissReason:
              "Discord üzerinde yetkili rolünün bulunmaması veya sunucudan çıkılması (Otomatik Senkronizasyon)",
          },
          {
            $set: {
              status: "active",
              dismissedAt: null,
              dismissReason: null,
            },
          }
        );
        logger.success(`[TEMPORARY RESTORE] Restored ${result.modifiedCount} staff members back to active.`);
      } catch (restoreErr) {
        logger.error("[TEMPORARY RESTORE] Error:", restoreErr.message);
      }
    }

    // Express sunucusunu hemen başlat (Render port binding için)
    app.listen(PORT, () => {
      logger.info(`Server: ${BASE_URL}`);
      logger.info(`Ticket Sistemi Aktif ve Port ${PORT} dinleniyor`);

      // Self-ping cron'u ancak sunucu gerçekten dinlemeye başladıktan
      // sonra kuruyoruz; böylece ilk taramalarda boşuna "failed" uyarısı
      // görmüyoruz.
      selfPingTask = cron.schedule("*/14 * * * *", async () => {
        try {
          await axios.get(`${BASE_URL}/api/health`);
          logger.info(`Self-ping OK`);
        } catch (e) {
          logger.warn("Self-ping failed:", e.message);
        }
      });
    });

    // Discord bot hazır olduğunda
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
              await msg.edit({ embeds: [successEmbed] }).catch(() => { });
            }, 15000);
          }
        }
      } catch (err) {
        logger.error("[index] Startup message error:", err.message);
      }
    });

    // Discord login'i arka planda, retry mantığıyla dene
    async function loginWithRetry(retries = 3, delayMs = 5000) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await discordBot.login(TOKEN);
          logger.success("Discord bot giriş isteği başarılı.");
          await new Promise((r) => setTimeout(r, 1000));
          await registerAllCommands().catch((err) => {
            logger.error("Komut kaydı hatası:", err.message);
          });
          return;
        } catch (err) {
          logger.error(`Discord login hatası (deneme ${attempt}/${retries}):`, err.message);
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, delayMs));
          } else {
            logger.error("Discord login tüm denemeler başarısız oldu. Sunucu yine de ayakta kalacak.");
          }
        }
      }
    }

    loginWithRetry();
  } catch (err) {
    logger.error("Başlatma hatası:", err);
    process.exit(1);
  }
}

start();