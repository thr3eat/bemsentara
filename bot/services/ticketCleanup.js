/**
 * Ticket Cleanup Servisi
 * Kapatılan ticketları izler — 5 dakika içinde yeniden açılmazsa
 * kanalı siler ve log kanalına bildirim gönderir.
 *
 * Ayrıca: Yetkili cevap vermiş ama kullanıcı 1 saat yanıt vermemişse
 * kullanıcıya DM uyarısı gönderir. 5 dk içinde yanıt gelmezse kapatır.
 */

const { EmbedBuilder } = require("discord.js");
const { TARGET_GUILD_ID, TICKET_LOG_CHANNEL_ID } = require("../../config");
const { getDiscordClient } = require("../discordClient");
const CLEANUP_DELAY_MS    = 2 * 60 * 1000;   // 2 dakika (eski: 5 dakika) — Kapalı ticketler hızlı silinsin
const CHECK_INTERVAL_MS   = 30 * 1000;        // 30 saniyede bir kontrol
const INACTIVITY_CHECK_MS = 5 * 60 * 1000;   // İnaktivite 5 dk'da bir kontrol
const INACTIVITY_WARN_MS  = 60 * 60 * 1000;  // 1 saat cevap yok → uyar
const INACTIVITY_CLOSE_MS = 5 * 60 * 1000;   // Uyarıdan 5 dk sonra kapat

// ticketId → setTimeout handle
const pendingDeletions = new Map();
// ticketId → { warnedAt: Date, closeHandle: Timeout }
const inactivityWarnings = new Map();

let checkInterval = null;
let inactivityInterval = null;

/**
 * Bot hazır olduğunda çağrılır — periyodik kontrol başlatır.
 */
function startCleanupScheduler() {
  if (checkInterval) return;
  checkInterval = setInterval(runCleanupCheck, CHECK_INTERVAL_MS);
  inactivityInterval = setInterval(runInactivityCheck, INACTIVITY_CHECK_MS);
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
  // İnaktivite uyarısı da iptal et
  cancelInactivityWarning(ticketId);
}

/**
 * İnaktivite uyarısını iptal et (kullanıcı cevap verdi)
 */
function cancelInactivityWarning(ticketId) {
  const w = inactivityWarnings.get(ticketId);
  if (w) {
    clearTimeout(w.closeHandle);
    inactivityWarnings.delete(ticketId);
  }
}

/**
 * Açık ticketlarda inaktivite kontrolü
 * Kural: Son mesaj yetkiliden geldiyse ve üzerinden 1 saat geçtiyse → kullanıcıya DM uyarısı
 */
async function runInactivityCheck() {
  const Ticket = require("../../models/Ticket");
  const client = getDiscordClient();
  if (!client?.isReady()) return;

  const now = Date.now();
  const warnCutoff = new Date(now - INACTIVITY_WARN_MS); // 1 saat önce

  try {
    const openTickets = await Ticket.find({ status: "open" });

    for (const ticket of openTickets) {
      // Zaten uyarı gönderilmiş mi?
      if (inactivityWarnings.has(ticket.ticketId)) continue;
      // Kanalı silinmiş mi?
      if (!ticket.channelId || ticket.channelDeleted) continue;

      try {
        const guildId = ticket.guildId || TARGET_GUILD_ID;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;

        const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
        if (!channel?.isTextBased()) continue;

        // Son 2 mesajı çek
        const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
        if (!messages || messages.size === 0) continue;

        const lastMsg = messages.first();
        if (!lastMsg) continue;

        // Son mesaj kullanıcıdan mı geldi? → İnaktivite yok
        if (lastMsg.author.id === ticket.userId) continue;
        // Son mesaj bottan mı? → Atla
        if (lastMsg.author.bot) continue;
        // 1 saat geçmedi mi?
        if (lastMsg.createdAt > warnCutoff) continue;

        // ── 1 saat geçmiş, son mesaj yetkiliden — uyar ─────────────────────
        console.log(`[ticketCleanup] ${ticket.ticketId} → inaktivite uyarısı gönderiliyor`);

        // Kullanıcıya DM
        try {
          const user = await client.users.fetch(ticket.userId);
          const { GUILD2_ID } = require("../../config");
          const serverName = guildId === GUILD2_ID ? "EkoYıldız" : "Sentara";

          await user.send(
            `📬 **Ticket Uyarısı — ${ticket.ticketId}**\n\n` +
            `Lütfen **${serverName}** sunucusundaki ticket'ınıza bakın!\n` +
            `Yetkili size cevap verdi ancak henüz yanıtlamadınız.\n\n` +
            `⚠️ **5 dakika içinde yanıt vermezseniz ticket otomatik kapatılacak.**`
          ).catch(() => {});
        } catch (_) {}

        // Kanala da bildirim
        await channel.send(
          `<@${ticket.userId}> ⏰ 1 saattir yanıt bekleniyor. **5 dakika içinde yanıt gelmezse ticket kapatılacak.**`
        ).catch(() => {});

        // 5 dakika sonra kapat
        const closeHandle = setTimeout(async () => {
          inactivityWarnings.delete(ticket.ticketId);

          // Hâlâ açık mı kontrol et
          const fresh = await Ticket.findOne({ ticketId: ticket.ticketId }).catch(() => null);
          if (!fresh || fresh.status !== "open") return;

          // Son mesaj hâlâ yetkiliden mi?
          try {
            const ch = await guild.channels.fetch(ticket.channelId).catch(() => null);
            if (ch?.isTextBased()) {
              const msgs = await ch.messages.fetch({ limit: 3 }).catch(() => null);
              if (msgs) {
                const last = msgs.first();
                if (last && last.author.id === ticket.userId) return; // Kullanıcı cevap verdi
              }
            }
          } catch (_) {}

          // Ticket'ı kapat
          fresh.status = "closed";
          fresh.closedAt = new Date();
          fresh.closeReason = "İnaktivite — kullanıcı 1 saat yanıt vermedi";
          fresh.closedBy = "system";
          fresh.closedByName = "Sistem";
          await fresh.save();

          // Kullanıcıya DM
          try {
            const user2 = await client.users.fetch(ticket.userId);
            await user2.send(
              `🔒 **Ticket'ınız Kapatıldı — ${ticket.ticketId}**\n\n` +
              `5 dakika içinde yanıt vermediğiniz için ticket otomatik kapatıldı.\n` +
              `İstediğiniz zaman yeni bir destek talebi açabilirsiniz.`
            ).catch(() => {});
          } catch (_) {}

          // Kanala bildirim + 5dk sonra sil
          try {
            const ch = await guild.channels.fetch(ticket.channelId).catch(() => null);
            if (ch) {
              await ch.send("🔒 Ticket inaktivite nedeniyle kapatıldı. Kanal 5 dakika içinde silinecek.").catch(() => {});
              await ch.permissionOverwrites.edit(ticket.userId, { ViewChannel: false, SendMessages: false }).catch(() => {});
            }
          } catch (_) {}

          scheduleTicketDeletion(ticket.ticketId);
          console.log(`[ticketCleanup] ${ticket.ticketId} → inaktivite ile kapatıldı`);

        }, INACTIVITY_CLOSE_MS);

        inactivityWarnings.set(ticket.ticketId, { warnedAt: new Date(), closeHandle });

      } catch (err) {
        console.warn(`[ticketCleanup] inaktivite kontrol hatası (${ticket.ticketId}):`, err.message);
      }
    }
  } catch (err) {
    console.warn("[ticketCleanup] runInactivityCheck hata:", err.message);
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
    const ticket = await Ticket.findOne({ ticketId }).catch(err => {
      console.error(`[ticketCleanup] DB error for ${ticketId}:`, err.message);
      return null;
    });
    
    if (!ticket) {
      console.log(`[ticketCleanup] ${ticketId} → DB'de bulunamadı`);
      return;
    }
    
    if (ticket.status === "open") {
      console.log(`[ticketCleanup] ${ticketId} → yeniden açılmış, silme iptal.`);
      return;
    }
    if (ticket.channelDeleted) {
      console.log(`[ticketCleanup] ${ticketId} → zaten silinmiş olarak işaretlenmiş`);
      return;
    }

    // Ticket'ın hangi sunucuda olduğunu belirle
    const guildId = ticket.guildId || TARGET_GUILD_ID;
    const guild = await client.guilds.fetch(guildId).catch(err => {
      console.error(`[ticketCleanup] Guild ${guildId} bulunamadı:`, err.code);
      return null;
    });
    
    if (!guild) {
      console.error(`[ticketCleanup] ${ticketId} → Guild fetch başarısız`);
      return;
    }

    // Kanalı sil
    let channelDeleted = false;
    if (ticket.channelId) {
      try {
        const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
        if (channel) {
          await channel.delete(`Ticket ${ticketId} — 2 dakika içinde yeniden açılmadı`);
          channelDeleted = true;
          console.log(`[ticketCleanup] ${ticketId} → kanal silindi.`);
        } else {
          console.log(`[ticketCleanup] ${ticketId} → kanal bulunamadı (zaten silinmiş olabilir)`);
        }
      } catch (chErr) {
        console.error(`[ticketCleanup] ${ticketId} → Kanal silme hatası:`, chErr.code, chErr.message);
        // Devam et - yine de DB'de işaretle
      }
    }

    // Ticket'ı güncelle
    ticket.channelDeleted = true;
    ticket.channelDeletedAt = new Date();
    await ticket.save().catch(err => {
      console.error(`[ticketCleanup] ${ticketId} → Save hatası:`, err.message);
    });

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
  cancelInactivityWarning,
};
