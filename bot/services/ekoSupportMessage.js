const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { GUILD2_ID } = require("../../config");

const EKO_SUPPORT_CHANNEL_ID = "1518692475189854218";

function getEkoSupportMenuEmbed() {
  return new EmbedBuilder()
    .setTitle("🛟 EkoYıldız Canlı Destek Paneli")
    .setDescription("Yaşadığınız soruna göre aşağıdan uygun kategoriyi seçerek destek talebi oluşturabilirsiniz.")
    .setColor(0x3498DB)
    .setFooter({ text: "EkoYıldız Destek Sistemi" });
}

function getEkoCategorySelectMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ekoyildiz_support_category")
      .setPlaceholder("Kategori seçin...")
      .addOptions(
        {
          label: "Kullanıcı destek (birisi seni rahatsız mı ediyor?)",
          value: "kullanici_destek",
          description: "Şikayet ve rahatsız edilme durumları",
          emoji: "👤"
        },
        {
          label: "Reklam Destek",
          value: "reklam_destek",
          description: "Reklam anlaşmaları ve destek talebi",
          emoji: "📢"
        },
        {
          label: "Diğer Destek",
          value: "diger_destek",
          description: "Diğer konular hakkında destek",
          emoji: "📝"
        }
      )
  );
}

async function ensureEkoSupportMessage(client) {
  try {
    const guild = await client.guilds.fetch(GUILD2_ID).catch(() => null);
    if (!guild) return;
    const channel = await guild.channels.fetch(EKO_SUPPORT_CHANNEL_ID).catch(() => null);
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
    const existingMessage = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title === "🛟 EkoYıldız Canlı Destek Paneli");

    if (!existingMessage) {
      const embed = getEkoSupportMenuEmbed();
      const menu = getEkoCategorySelectMenu();
      await channel.send({ embeds: [embed], components: [menu] });
      console.log("✅ EkoYıldız destek sistemi mesajı gönderildi");
    }
  } catch (error) {
    console.error("❌ EkoYıldız destek mesajı kontrol edilirken hata:", error);
  }
}

module.exports = {
  ensureEkoSupportMessage
};
