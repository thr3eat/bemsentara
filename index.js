const app = require("./server/app");
const { createDiscordClient } = require("./bot/client");
const { initializeDiscordHandlers } = require("./bot/handlers");
const { registerAllCommands } = require("./bot/registerCommands");
const { PORT, BASE_URL, TOKEN } = require("./config");
const path = require("path");
const cron = require("node-cron");
const axios = require("axios");

const discordBot = createDiscordClient();
initializeDiscordHandlers(discordBot);

cron.schedule("*/14 * * * *", async () => {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    console.log(`[CRON] Self-ping OK - ${new Date().toISOString()}`);
  } catch (e) {
    console.warn("[CRON] Self-ping failed:", e.message);
  }
});

async function start() {
  try {
    console.log("✅ In-memory veri deposu hazır");

    await discordBot.login(TOKEN);
    console.log("✅ Discord bot başlatıldı");

    await registerAllCommands();

    app.listen(PORT, () => {
      console.log(`🌐 Server: ${BASE_URL}`);
      console.log(`🎫 Ticket Sistemi Aktif`);
    });
  } catch (err) {
    console.error("❌ Başlatma hatası:", err);
    process.exit(1);
  }
}

start();
