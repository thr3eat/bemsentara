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
    const counts = initStore();
    const { STORE_FILE } = require("./models/persistence");
    logger.success(
      `Veri deposu yüklendi: ${counts.users} kullanıcı, ${counts.tickets} ticket, ${counts.wikiArticles} wiki → ${STORE_FILE}`
    );

    process.on("SIGINT", () => {
      saveStoreNow();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      saveStoreNow();
      process.exit(0);
    });

    await discordBot.login(TOKEN);
    logger.success("Discord bot başlatıldı");

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
