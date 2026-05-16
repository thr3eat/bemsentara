const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  TARGET_GUILD_ID,
  VERIFY_CHANNEL_ID,
  BASE_URL,
} = require("../../config");

/** Mevcut mesajı tanımak için footer işareti */
const VERIFY_HELP_MARKER = "Sentara-Verify-Help-v1";

function getVerifyHelpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🔐 Doğrulama ve Rol Güncelleme")
    .setDescription(
      "Roblox **BEM** grubundaki rütbenize göre Discord rolleriniz otomatik verilir.\n\n" +
        "Aşağıdaki adımları sırayla uygulayın."
    )
    .addFields(
      {
        name: "1️⃣ Roblox hesabını bağla",
        value:
          "• Sunucuda `/authorize` yazın ve çıkan bağlantıya tıklayın\n" +
          `• Veya siteye girip Discord + Roblox ile giriş yapın: [Dashboard](${BASE_URL}/dashboard)`,
        inline: false,
      },
      {
        name: "2️⃣ İlk doğrulama — `/verify`",
        value:
          "Hesabınız bağlıysa Roblox rütbenize göre rolleriniz **ilk kez** atanır.\n" +
          "Yanıt yalnızca size görünür.",
        inline: false,
      },
      {
        name: "3️⃣ Rol güncelleme — `/update`",
        value:
          "Grupta rütbe değiştirdiyseniz veya rolleriniz eksikse `/update` kullanın.\n" +
          "Ana grup + branş grupları kontrol edilir; eklenen/kaldırılan roller listelenir.",
        inline: false,
      },
      {
        name: "🌐 Web üzerinden güncelleme",
        value:
          `[Dashboard](${BASE_URL}/dashboard) → **Rolleri Güncelle** butonuna tıklayın.\n` +
          "Roblox bağlı değilse önce bağlantı yapmanız istenir.",
        inline: false,
      },
      {
        name: "⚠️ Bilmeniz gerekenler",
        value:
          "• Ana **BEM** grubunun üyesi olmalısınız\n" +
          "• Discord rol adları, Roblox rütbe adlarıyla aynı olmalıdır\n" +
          "• Branş daireniz varsa ilgili branş grubuna da üye olun\n" +
          "• Sorun yaşarsanız ticket açın veya yetkililere yazın",
        inline: false,
      }
    )
    .setFooter({ text: `${VERIFY_HELP_MARKER} • Sentara` })
    .setTimestamp();
}

function getVerifyHelpComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Roblox Bağla / Dashboard")
        .setStyle(ButtonStyle.Link)
        .setURL(`${BASE_URL}/dashboard`),
      new ButtonBuilder()
        .setCustomId("verify_help_refresh")
        .setLabel("ℹ️ Komut Özeti")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function isVerifyHelpMessage(message, botId) {
  if (message.author?.id !== botId) return false;
  const embed = message.embeds?.[0];
  if (!embed) return false;
  const footer = embed.footer?.text || "";
  const title = embed.title || "";
  return (
    footer.includes(VERIFY_HELP_MARKER) ||
    title.includes("Doğrulama ve Rol Güncelleme")
  );
}

/**
 * Doğrulama kanalına yardım mesajını gönderir (yoksa).
 */
async function ensureVerifyHelpMessage(client) {
  const logger = require("../../utils/logger");

  if (!VERIFY_CHANNEL_ID) {
    logger.warn("VERIFY_CHANNEL_ID tanımlı değil, doğrulama mesajı atlanıyor.");
    return { posted: false, reason: "no_channel_config" };
  }

  try {
    const guild = await client.guilds.fetch(TARGET_GUILD_ID);
    const channel = await guild.channels.fetch(VERIFY_CHANNEL_ID);

    if (!channel?.isTextBased()) {
      logger.warn(`Doğrulama kanalı metin kanalı değil: ${VERIFY_CHANNEL_ID}`);
      return { posted: false, reason: "invalid_channel" };
    }

    let existing = null;
    let lastId = undefined;

    for (let i = 0; i < 5; i++) {
      const batch = await channel.messages.fetch({ limit: 100, before: lastId });
      if (batch.size === 0) break;

      existing = batch.find((m) => isVerifyHelpMessage(m, client.user.id));
      if (existing) break;

      lastId = batch.last()?.id;
      if (batch.size < 100) break;
    }

    if (existing) {
      logger.info(`Doğrulama yardım mesajı zaten var (${existing.id}), atlanıyor.`);
      return { posted: false, reason: "already_exists", messageId: existing.id };
    }

    const sent = await channel.send({
      embeds: [getVerifyHelpEmbed()],
      components: getVerifyHelpComponents(),
    });

    logger.success(`Doğrulama yardım mesajı gönderildi: #${channel.name} (${sent.id})`);
    return { posted: true, messageId: sent.id };
  } catch (err) {
    logger.error("Doğrulama yardım mesajı gönderilemedi:", err.message);
    return { posted: false, reason: "error", error: err.message };
  }
}

module.exports = {
  VERIFY_HELP_MARKER,
  getVerifyHelpEmbed,
  getVerifyHelpComponents,
  ensureVerifyHelpMessage,
  isVerifyHelpMessage,
};
