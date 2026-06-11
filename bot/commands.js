const { SlashCommandBuilder, REST, Routes } = require("discord.js");
const { BOT_ID, TOKEN } = require("../config");

const botSlashCommands = [
  new SlashCommandBuilder().setName("support").setDescription("Destek menüsünü aç"),
  new SlashCommandBuilder()
    .setName("mytickets")
    .setDescription("Açık ticket'larını göster")
    .setDMPermission(true),
  new SlashCommandBuilder()
    .setName("closeticket")
    .setDescription("Ticket'ı kapat")
    .addStringOption((o) =>
      o.setName("reason").setDescription("Kapanış sebebi").setRequired(false)
    )
    .setDMPermission(true),
  new SlashCommandBuilder().setName("profile").setDescription("Profil bilgilerini göster").setDMPermission(true),
  new SlashCommandBuilder().setName("authorize").setDescription("Roblox hesabını yetkilendir").setDMPermission(true),
  new SlashCommandBuilder()
    .setName("posttmtrules")
    .setDescription("TMT sunucu kurallarını gönder (Admin Sadece)")
    .setDefaultMemberPermissions(0), // Admin only
].map((c) => c.toJSON());

async function registerDiscordCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    console.log("Discord slash komutları kaydediliyor...");
    await rest.put(Routes.applicationCommands(BOT_ID), {
      body: botSlashCommands,
    });
    console.log("✅ Komutlar başarıyla kaydedildi.");
  } catch (err) {
    console.error("Komut kayıt hatası:", err);
  }
}

module.exports = { botSlashCommands, registerDiscordCommands };
