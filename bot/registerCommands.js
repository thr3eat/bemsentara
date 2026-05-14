const { REST, Routes } = require("discord.js");
const { TOKEN, BOT_ID } = require("../config");
const { allCommands } = require("./allCommands");

async function registerAllCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    console.log("Tüm slash komutları kaydediliyor...");
    await rest.put(Routes.applicationCommands(BOT_ID), {
      body: allCommands,
    });
    console.log(`✅ ${allCommands.length} komut başarıyla kaydedildi.`);
  } catch (err) {
    console.error("Komut kayıt hatası:", err);
  }
}

module.exports = { registerAllCommands };
