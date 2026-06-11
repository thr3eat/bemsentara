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

/**
 * Merkezi denetim günlüğü event listenerlarını kaydet
 * @param {import('discord.js').Client} client 
 */
function setupCentralAuditHandler(client) {
  // ─── Üye Olayları ────────────────────────────────────────────────────────
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
    } catch (err) {
      console.error("[CentralAudit] guildMemberRemove hatası:", err.message);
    }
  });

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      await logMemberUpdate(oldMember, newMember);
    } catch (err) {
      console.error("[CentralAudit] guildMemberUpdate hatası:", err.message);
    }
  });

  // ─── Mesaj Olayları ──────────────────────────────────────────────────────
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

  // ─── Rol Olayları ────────────────────────────────────────────────────────
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

  // ─── Kanal Olayları ──────────────────────────────────────────────────────
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

  // ─── Moderasyon Olayları ─────────────────────────────────────────────────
  client.on("guildBanAdd", async (ban) => {
    try {
      await logUserBan(ban);
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

  client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
      // Timeout durumunu kontrol et
      await logMemberTimeout(oldMember, newMember);
    } catch (err) {
      console.error("[CentralAudit] timeout detection hatası:", err.message);
    }
  });

  // ─── Ses Olayları ────────────────────────────────────────────────────────
  client.on("voiceStateUpdate", async (oldState, newState) => {
    try {
      // Katılım
      if (!oldState.channel && newState.channel) {
        await logVoiceJoin(oldState, newState);
      }
      // Ayrılış
      else if (oldState.channel && !newState.channel) {
        await logVoiceLeave(oldState, newState);
      }
      // Kanal değişimi (taşıma)
      else if (oldState.channel?.id !== newState.channel?.id) {
        await logVoiceMove(oldState, newState);
      }
    } catch (err) {
      console.error("[CentralAudit] voiceStateUpdate hatası:", err.message);
    }
  });

  console.log("✅ Merkezi Denetim Günlüğü Event Handler başarıyla yüklendi!");
}

module.exports = { setupCentralAuditHandler };
