/**
 * Ticket Cleanup Servisi
 * Kapatılan ticketları izler — 5 dakika içinde yeniden açılmazsa
 * kanalı siler ve log kanalına bildirim gönderir.
 */

const { EmbedBuilder } = require("discord.js");
const { TARGET_GUILD_ID, TICKET_LOG_CHANNEL_ID } = require("../../config");
const { getDiscordClient } = require("../discordClient");
const CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 dakika
const CHECK_INTERVAL_MS = 30 * 1000;     // 30 saniyede bir kontrol

// ticketId → setTimeout handle
const pendingDeletions = new Map();

let checkInterval = null;

/**
 * Bot hazır olduğunda çağrılır — periyodik kontrol başlatır.
 */
function startCleanupScheduler() {
  if (checkInterval) return; // Zaten çalışıyor
  checkInterval = setInterval(runCleanupCheck, CHECK_INTERVAL_MS);
  console.log("[ticketCleanup] Zamanlayıcı başlatıldı (30s aralık).");
}

/**
 * Ticket kapatıldığında çağrılır.
 * 5 dakika sonra silinmek üzere kuyruğa alır.
 * @param {string} ticketId
 */
function scheduleTicketDeletion(ticketId) {
  // Zaten kuyruktaysa iptal et ve yeniden ekle
  if (pendingDeletions.has(ticketId)) {
    clearTimeout(pendingDeletions.get(ticketId));
  }

  const handle = setTimeout(() => {
    pendingDeletions.delete(ticketId);
    deleteTicketChannel(ticketId);
  }, CLEANUP_DELAY_MS);

  pendingDeletions.set(ticketId, handle);
  console.log(`[ticketCleanup] ${ticketId} → 5 dakika sonra silinecek.`);
}

/**
 * Ticket yeniden açıldığında çağrılır — silme işlemini iptal eder.
 * @param {string} ticketId
 */
function cancelTicketDeletion(ticketId) {
  if (pendingDeletions.has(ticketId)) {
    clearTimeout(pendingDeletions.get(ticketId));
    pendingDeletions.delete(ticketId);
    console.log(`[ticketCleanup] ${ticketId} → silme iptal edildi (yeniden açıldı).`);
  }
}

/**
 * Periyodik kontrol — restart sonrası bellekte olmayan eski kapalı ticketları yakalar.
 */
async function runCleanupCheck() {
  const Ticket = require("../../models/Ticket");
  const now = Date.now();
  const cutoff = new Date(now - CLEANUP_DELAY_MS);

  try {
    const closedTickets = await Ticket.find({ status: "closed" });

    for (const ticket of closedTickets) {
      // Kanal zaten silinmişse atla
      if (!ticket.channelId || ticket.channelDeleted) continue;

      // Bellekte zaten kuyruktaysa atla (setTimeout zaten çalışıyor)
      if (pendingDeletions.has(ticket.ticketId)) continue;

      // 5 dakikadan önce kapandıysa atla
      const closedAt = ticket.closedAt ? new Date(ticket.closedAt) : null;
      if (!closedAt || closedAt > cutoff) continue;

      // 5 dakika geçmiş, bellekte kuyruk yok → hemen sil
      console.log(`[ticketCleanup] ${ticket.ticketId} → periyodik kontrol ile siliniyor.`);
      deleteTicketChannel(ticket.ticketId);
    }
  } catch (err) {
    console.warn("[ticketCleanup] Periyodik kontrol hatası:", err.message);
  }
}

/**
 * Ticket kanalını siler ve log kanalına bildirim gönderir.
 * @param {string} ticketId
 */
async function deleteTicketChannel(ticketId) {
  const Ticket = require("../../models/Ticket");
  const client = getDiscordClient();
  const { TARGET_GUILD_ID, GUILD2_ID } = require("../../config");

  if (!client?.isReady()) {
    console.warn(`[ticketCleanup] ${ticketId} → bot hazır değil, silme ertelendi.`);
    setTimeout(() => deleteTicketChannel(ticketId), 60_000);
    return;
  }

  try {
    const ticket = await Ticket.findOne({ ticketId });
    if (!ticket) return;
    if (ticket.status === "open") {
      console.log(`[ticketCleanup] ${ticketId} → yeniden açılmış, silme iptal.`);
      return;
    }
    if (ticket.channelDeleted) return;

    // Ticket'ın hangi sunucuda olduğunu belirle
    const guildId = ticket.guildId || TARGET_GUILD_ID;
    const guild = await client.guilds.fetch(guildId);

    // Kanalı sil
    let channelDeleted = false;
    if (ticket.channelId) {
      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
      if (channel) {
        await channel.delete(`Ticket ${ticketId} — 5 dakika içinde yeniden açılmadı`);
        channelDeleted = true;
        console.log(`[ticketCleanup] ${ticketId} → kanal silindi.`);
      }
    }

    // Ticket'ı güncelle
    ticket.channelDeleted = true;
    ticket.channelDeletedAt = new Date();
    await ticket.save();

    // Log kanalına bildirim gönder
    const { TICKET_LOG_CHANNEL_ID, GUILD2_TICKET_LOG_ID } = require("../../config");
    const logChannelId = (guildId === GUILD2_ID && GUILD2_TICKET_LOG_ID)
      ? GUILD2_TICKET_LOG_ID
      : TICKET_LOG_CHANNEL_ID;

    if (logChannelId) {
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel?.isSendable()) {
        const embed = new EmbedBuilder()
          .setColor(0x6b7280)
          .setTitle("🗑️ Ticket Kanalı Silindi")
          .addFields(
            { name: "Ticket ID",    value: `\`${ticket.ticketId}\``,                          inline: true },
            { name: "Açan",         value: `<@${ticket.userId}>`,                              inline: true },
            { name: "Kapatan",      value: ticket.closedBy ? `<@${ticket.closedBy}>` : ticket.closedByName || "—", inline: true },
            { name: "Konu",         value: ticket.subject || "—",                              inline: false },
            { name: "Kapanış Sebebi", value: ticket.closeReason || "Belirtilmedi",             inline: false },
            { name: "Kapatılma",    value: ticket.closedAt ? `<t:${Math.floor(new Date(ticket.closedAt).getTime() / 1000)}:R>` : "—", inline: true },
            { name: "Kanal Silindi", value: `<t:${Math.floor(Date.now() / 1000)}:R>`,          inline: true },
          )
          .setDescription("Ticket 5 dakika içinde yeniden açılmadığı için kanal otomatik silindi.")
          .setFooter({ text: "Sentara • Otomatik Temizlik" })
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error(`[ticketCleanup] ${ticketId} silinirken hata:`, err.message);
  }
}

module.exports = {
  startCleanupScheduler,
  scheduleTicketDeletion,
  cancelTicketDeletion,
};
