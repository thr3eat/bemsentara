const { REST, Routes } = require("discord.js");
const { TOKEN, BOT_ID } = require("../config");
const { allCommands } = require("./allCommands");
const logger = require("../utils/logger");

async function registerAllCommands(clientId = BOT_ID) {
  try {
    const cid = clientId || BOT_ID;
    if (!cid) {
      throw new Error("Client ID (BOT_ID) bulunamadı. Slash komutlar kaydedilemez.");
    }
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    logger.section("SLASH COMMANDS");
    logger.step(`Komut sayısı: ${allCommands.length}`);

    await rest.put(Routes.applicationCommands(cid), {
      body: allCommands,
    });
    logger.success(`${allCommands.length} slash komut kaydedildi.`);
  } catch (err) {
    logger.error("Slash komut kayıt hatası:", err.message);
    if (err.rawError) {
      logger.error("Detay:", err.rawError);
    }
    if (err.status) {
      logger.error("Status:", err.status);
    }
  }
}

module.exports = { registerAllCommands };
