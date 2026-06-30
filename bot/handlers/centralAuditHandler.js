/**
 * Merkezi Denetim Günlüğü Event Handler
 * Tüm üç sunucudaki olayları takip eder ve Allied Orduları sunucusuna gönderir
 */

const {
  logMemberJoin,
  logMemberLeave,
  logMemberUpdate,
  logMessageDelete,
  logMessageUpdate,
  logBulkMessageDelete,
  logRoleCreate,
  logRoleDelete,
  logRoleUpdate,
  logChannelCreate,
  logChannelDelete,
  logChannelUpdate,
  logUserBan,
  logUserUnban,
  logMemberTimeout,
  logVoiceJoin,
  logVoiceLeave,
  logVoiceMove
} = require("../services/centralAuditLog");
const { recordModAction, isStaffMember, REPORT_GUILD_ID } = require("../services/modReportTracker");
const { AuditLogEvent } = require("discord.js");

// ─── Yardımcı: Audit Log'dan işlemi yapan personeli bul ve kaydet ────────────
/**
 * @param {import('discord.js').Guild} guild
 * @param {AuditLogEvent} type
 * @param {string} targetId
 * @param {string} actionType     - 'kick' | 'ban' | 'timeout'
 * @param {string} targetTag
 * @param {string} [extraReason]
 */
async function detectAndRecord(guild, type, targetId, actionType, targetTag, extraReason) {
  if (guild?.id !== REPORT_GUILD_ID) return;
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 5, type });
    const entry = auditLogs.entries.first();
    if (!entry) return;
    if (entry.target?.id !== targetId) return;
    if (Date.now() - entry.createdTimestamp >= 10000) return;
    if (entry.executor?.bot) return;

    const executor = await guild.members.fetch(entry.executor.id).catch(() => null);
    if (executor && isStaffMember(executor)) {
      recordModAction(
        entry.executor.id,
        actionType,
        targetId,
        targetTag,
        extraReason || entry.reason || 'Sebep belirtilmedi'
      );
    }
  } catch (_) { }
}

// ─── Handler Kurulumu ─────────────────────────────────────────────────────────
/**
 * Merkezi denetim günlüğü event listenerlarını kaydet
 * @param {import('discord.js').Client} client
 */
function setupCentralAuditHandler(client) {
  // ─── Üye Olayları ──────────────────────────────────────────────────────────
  client.on("guildMemberAdd", async (member) => {
    try {
      await logMemberJoin(member);
    } catch (err) {
      console.error("[CentralAudit] guildMemberAdd hatası:", err.message);
    }
  });

  client.on("guildMemberRemove", async (member) => {
    try {
      await logMemberLeave(member);
      await detectAndRecord(
        member.guild,
        AuditLogEvent.MemberKick,
        member.id,
        'kick',
        member.user.tag
      );
    } catch (err) {
      console.error("[CentralAudit] guildMemberRemove hatası:", err.message);
    }
  });

  // FIX: Tek bir guildMemberUpdate — hem logMemberUpdate, hem logMemberTimeout,
  // hem de timeout rapor takibi burada birleştirildi.
  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      await logMemberUpdate(oldMember, newMember);
      await logMemberTimeout(oldMember, newMember);

      // Timeout rapor takibi: sadece yeni timeout uygulandıysa
      if (
        !oldMember.communicationDisabledUntil &&
        newMember.communicationDisabledUntil
      ) {
        const duration = newMember.communicationDisabledUntil.getTime() - Date.now();
        const mins = Math.floor(duration / 60000);
        await detectAndRecord(
          newMember.guild,
          AuditLogEvent.MemberUpdate,
          newMember.id,
          'timeout',
          newMember.user.tag,
          `Timeout süresi: ${mins} dakika`
        );
      }
    } catch (err) {
      console.error("[CentralAudit] guildMemberUpdate hatası:", err.message);
    }
  });

  // ─── Mesaj Olayları ────────────────────────────────────────────────────────
  client.on("messageDelete", async (message) => {
    try {
      await logMessageDelete(message);
    } catch (err) {
      console.error("[CentralAudit] messageDelete hatası:", err.message);
    }
  });

  client.on("messageUpdate", async (oldMessage, newMessage) => {
    try {
      await logMessageUpdate(oldMessage, newMessage);
    } catch (err) {
      console.error("[CentralAudit] messageUpdate hatası:", err.message);
    }
  });

  client.on("messageDeleteBulk", async (messages) => {
    try {
      await logBulkMessageDelete(messages);
    } catch (err) {
      console.error("[CentralAudit] messageDeleteBulk hatası:", err.message);
    }
  });

  // ─── Rol Olayları ──────────────────────────────────────────────────────────
  client.on("roleCreate", async (role) => {
    try {
      await logRoleCreate(role);
    } catch (err) {
      console.error("[CentralAudit] roleCreate hatası:", err.message);
    }
  });

  client.on("roleDelete", async (role) => {
    try {
      await logRoleDelete(role);
    } catch (err) {
      console.error("[CentralAudit] roleDelete hatası:", err.message);
    }
  });

  client.on("roleUpdate", async (oldRole, newRole) => {
    try {
      await logRoleUpdate(oldRole, newRole);
    } catch (err) {
      console.error("[CentralAudit] roleUpdate hatası:", err.message);
    }
  });

  // ─── Kanal Olayları ────────────────────────────────────────────────────────
  client.on("channelCreate", async (channel) => {
    try {
      await logChannelCreate(channel);
    } catch (err) {
      console.error("[CentralAudit] channelCreate hatası:", err.message);
    }
  });

  client.on("channelDelete", async (channel) => {
    try {
      await logChannelDelete(channel);
    } catch (err) {
      console.error("[CentralAudit] channelDelete hatası:", err.message);
    }
  });

  client.on("channelUpdate", async (oldChannel, newChannel) => {
    try {
      await logChannelUpdate(oldChannel, newChannel);
    } catch (err) {
      console.error("[CentralAudit] channelUpdate hatası:", err.message);
    }
  });

  // ─── Moderasyon Olayları ───────────────────────────────────────────────────
  client.on("guildBanAdd", async (ban) => {
    try {
      await logUserBan(ban);
      await detectAndRecord(
        ban.guild,
        AuditLogEvent.MemberBanAdd,
        ban.user.id,
        'ban',
        ban.user.tag,
        ban.reason
      );
    } catch (err) {
      console.error("[CentralAudit] guildBanAdd hatası:", err.message);
    }
  });

  client.on("guildBanRemove", async (ban) => {
    try {
      await logUserUnban(ban);
    } catch (err) {
      console.error("[CentralAudit] guildBanRemove hatası:", err.message);
    }
  });

  // ─── Ses Olayları ──────────────────────────────────────────────────────────
  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      if (!oldState.channel && newState.channel) {
        await logVoiceJoin(oldState, newState);
      } else if (oldState.channel && !newState.channel) {
        await logVoiceLeave(oldState, newState);
      } else if (oldState.channel?.id !== newState.channel?.id) {
        await logVoiceMove(oldState, newState);
      }
    } catch (err) {
      console.error("[CentralAudit] voiceStateUpdate hatası:", err.message);
    }
  });

  console.log("✅ Merkezi Denetim Günlüğü Event Handler başarıyla yüklendi!");
}

module.exports = { setupCentralAuditHandler };