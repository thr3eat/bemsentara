const { AuditLogEvent } = require("discord.js");
const GuildAuth = require("../../models/GuildAuth");
const ServerSetup = require("../../models/ServerSetup");

const WHITELISTED_GUILDS = new Set([
  "1483482948320891074", // Central Guild
  "1367646464804655104", // EkoYıldız
  "1414639355456389344"  // BEM Sentara
]);

/**
 * Checks if a guild is authorized for the bot to be used.
 * @param {import('discord.js').Guild} guild 
 * @returns {Promise<boolean>}
 */
async function isGuildAuthorized(guild) {
  if (!guild) return false;
  if (WHITELISTED_GUILDS.has(guild.id)) return true;

  const db = require("../../models/db");
  if (!db.isMongoActive()) return true;

  // 1. Check database cache
  try {
    const auth = await GuildAuth.findOne({ guildId: guild.id });
    if (auth) {
      if (!auth.authorized) {
        // If stored as unauthorized, leave the guild
        await guild.leave().catch(() => {});
      }
      return auth.authorized;
    }
  } catch (err) {
    console.error("[GuildAuth] Database query error:", err.message);
  }

  // 2. Check if a setup document already exists
  try {
    const setupDoc = await ServerSetup.findOne({ guildId: guild.id });
    if (setupDoc) {
      await GuildAuth.create({ guildId: guild.id, authorized: true }).catch(() => {});
      return true;
    }
  } catch (err) {
    console.error("[GuildAuth] ServerSetup check error:", err.message);
  }

  // 3. Fetch audit logs to find who added the bot
  let inviterId = null;
  try {
    const auditLogs = await guild.fetchAuditLogs({ limit: 5, type: AuditLogEvent.BotAdd }).catch(() => null);
    if (auditLogs) {
      const entry = auditLogs.entries.find(e => e.target?.id === guild.members.me?.id);
      if (entry && entry.executor) {
        inviterId = entry.executor.id;
      }
    }
  } catch (err) {
    console.warn("[GuildAuth] Could not fetch audit logs for BotAdd:", err.message);
  }

  // 4. Validate inviter role in Central Guild
  let authorized = false;
  if (inviterId) {
    try {
      const centralGuild = guild.client.guilds.cache.get("1483482948320891074")
        || await guild.client.guilds.fetch("1483482948320891074").catch(() => null);
      if (centralGuild) {
        const member = await centralGuild.members.fetch(inviterId).catch(() => null);
        if (member && member.roles.cache.has("1521519524812165280")) {
          authorized = true;
        }
      }
    } catch (err) {
      console.error("[GuildAuth] Central guild role check error:", err.message);
    }
  } else {
    // If we could not fetch the inviter, we do not want to lock them out immediately in case they are running setup.
    // So we return true for now, but do not cache it, so we check again.
    return true;
  }

  // 5. Store result
  try {
    await GuildAuth.create({
      guildId: guild.id,
      inviterId,
      authorized
    });
  } catch (err) {
    console.error("[GuildAuth] Error saving auth:", err.message);
  }

  if (!authorized) {
    console.log(`[GuildAuth] ❌ Guild ${guild.name} (${guild.id}) is not authorized. Leaving guild...`);
    await guild.leave().catch(() => {});
  }

  return authorized;
}

module.exports = { isGuildAuthorized };
