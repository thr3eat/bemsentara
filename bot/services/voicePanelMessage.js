const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const {
  TARGET_GUILD_ID,
  VOICE_PANEL_CHANNEL_ID,
  GUILD2_ID,
  GUILD2_VOICE_PANEL_ID,
} = require("../../config");

const VOICE_PANEL_MARKER = "Sentara-Voice-Panel-v1";

function getVoicePanelEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🔊 Ses Sistemi Paneli")
    .setDescription(
      "Butonlara basarak özel ses kanalını yönetebilirsin. Kilitle/aç, kullanıcı ekle-çıkar, yeniden adlandır ve daha fazlası!\n\n" +
        "**Ses Sistemi**"
    )
    .addFields({
      name: "📜 Buton Açıklamaları",
      value:
        "➕ **Kanal oluştur** – Yeni bir ses kanalı oluşturur.\n" +
        "✏️ **Yeniden adlandır** – Kanalın adını değiştirir.\n" +
        "🗑️ **Sil** – Kanalı tamamen kaldırır.\n" +
        "➕ **Kullanıcı ekle** – Kanala kullanıcı ekler.\n" +
        "➖ **Kullanıcı çıkar** – Kanaldan kullanıcıyı kaldırır.\n" +
        "🔒 **Kilitle** – Kanalı kilitler.\n" +
        "🔓 **Kilidi kaldır** – Kanalın kilidini açar.\n" +
        "👥 **Üye sayısı** – Kullanıcı sayısını gösterir.\n" +
        "👢 **Kanaldan at** – Kullanıcıyı çıkarır.\n" +
        "ℹ️ **Kanal bilgisi** – Detaylı bilgi verir.\n" +
        "🎭 **Rol ekle** – Kanala özel rol ekler.\n" +
        "🎭 **Rol çıkar** – Kanaldan rolü kaldırır.",
      inline: false,
    })
    .setFooter({ text: `${VOICE_PANEL_MARKER} • Sentara` })
    .setTimestamp();
}

function getVoicePanelComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("voice_create").setLabel("Kanal Oluştur").setEmoji("➕").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("voice_rename").setLabel("Yeniden Adlandır").setEmoji("✏️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("voice_delete").setLabel("Sil").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("voice_add").setLabel("Kullanıcı Ekle").setEmoji("➕").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice_remove").setLabel("Kullanıcı Çıkar").setEmoji("➖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice_lock").setLabel("Kilitle").setEmoji("🔒").setStyle(ButtonStyle.Secondary)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("voice_unlock").setLabel("Kilidi Kaldır").setEmoji("🔓").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice_limit").setLabel("Üye Sayısı").setEmoji("👥").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice_kick").setLabel("Kanaldan At").setEmoji("👢").setStyle(ButtonStyle.Secondary)
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("voice_info").setLabel("Kanal Bilgisi").setEmoji("ℹ️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("voice_role_add").setLabel("Rol Ekle").setEmoji("🎭").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("voice_role_remove").setLabel("Rol Çıkar").setEmoji("🎭").setStyle(ButtonStyle.Secondary)
  );
  return [row1, row2, row3, row4];
}

function isVoicePanelMessage(message, botId) {
  if (message.author?.id !== botId) return false;
  const embed = message.embeds?.[0];
  return (
    embed?.footer?.text?.includes(VOICE_PANEL_MARKER) ||
    embed?.title?.includes("Ses Sistemi Paneli")
  );
}

/**
 * Belirtilen sunucu + kanala ses paneli gönderir (yoksa).
 */
async function ensureVoicePanelForGuild(client, guildId, channelId) {
  const logger = require("../../utils/logger");
  if (!channelId) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;

    let existing = null;
    let lastId;
    for (let i = 0; i < 5; i++) {
      const batch = await channel.messages.fetch({ limit: 100, before: lastId });
      if (batch.size === 0) break;
      existing = batch.find((m) => isVoicePanelMessage(m, client.user.id));
      if (existing) break;
      lastId = batch.last()?.id;
      if (batch.size < 100) break;
    }

    if (existing) {
      logger.info(`[${guild.name}] Ses paneli zaten var (${existing.id})`);
      return;
    }

    await channel.send({
      embeds: [getVoicePanelEmbed()],
      components: getVoicePanelComponents(),
    });
    logger.success(`[${guild.name}] Ses sistemi paneli gönderildi → #${channel.name}`);
  } catch (err) {
    logger.error(`[voicePanel] ${guildId} için panel gönderilemedi:`, err.message);
  }
}

/**
 * Tüm sunuculara ses paneli gönderir.
 */
async function ensureVoicePanelMessage(client) {
  // Ana sunucu
  await ensureVoicePanelForGuild(client, TARGET_GUILD_ID, VOICE_PANEL_CHANNEL_ID);
  // İkinci sunucu
  if (GUILD2_ID && GUILD2_VOICE_PANEL_ID) {
    await ensureVoicePanelForGuild(client, GUILD2_ID, GUILD2_VOICE_PANEL_ID);
  }
}

module.exports = {
  ensureVoicePanelMessage,
  ensureVoicePanelForGuild,
  getVoicePanelEmbed,
  getVoicePanelComponents,
};
