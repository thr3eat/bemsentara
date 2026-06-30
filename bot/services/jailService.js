'use strict';

const { EmbedBuilder, ChannelType } = require("discord.js");
const User = require("../../models/User");

/**
 * Configure the Hapis role permissions on all categories.
 * Denies viewing all categories except 1521501154339586078.
 */
async function setupHapisRoleOverwrites(guild, hapisRole) {
  for (const channel of guild.channels.cache.values()) {
    if (channel.type === ChannelType.GuildCategory) {
      try {
        if (channel.id === "1521501154339586078") {
          await channel.permissionOverwrites.create(hapisRole, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          }, { reason: "Hapis kategorisi izni" }).catch(() => {});
        } else {
          await channel.permissionOverwrites.create(hapisRole, {
            ViewChannel: false
          }, { reason: "Hapis cezalı erişim engeli" }).catch(() => {});
        }
      } catch (err) {
        console.warn(`[JailService] Override set error for category ${channel.name}:`, err.message);
      }
    }
  }
}

/**
 * Jails a user.
 */
async function jailUser(client, guild, userId, reason, durationMinutes, moderatorId) {
  try {
    let dbUser = await User.findOne({ discordId: userId });
    if (!dbUser) {
      dbUser = new User({ discordId: userId, discordUsername: "Bilinmiyor" });
    }

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return false;

    // Find or create Hapis role
    let hapisRole = guild.roles.cache.find(r => r.name.toLowerCase() === "hapis");
    if (!hapisRole) {
      hapisRole = await guild.roles.create({
        name: "Hapis",
        color: "#808080",
        reason: "Hapis cezası için sistem tarafından otomatik oluşturuldu.",
        position: 1
      }).catch(() => null);
      if (hapisRole) {
        await setupHapisRoleOverwrites(guild, hapisRole);
      }
    }

    if (!hapisRole) return false;

    // Save current roles (excluding managed/everyone/hapis role and roles higher than bot) and strip them
    const botHighestRole = guild.members.me.roles.highest;
    const currentRoles = member.roles.cache
      .filter(r => r.id !== guild.id && !r.managed && r.id !== hapisRole.id && botHighestRole.comparePositionTo(r) > 0)
      .map(r => r.id);

    dbUser.isJailed = true;
    dbUser.jailedRoles = currentRoles;
    dbUser.jailedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
    dbUser.jailReason = reason;
    dbUser.jailedBy = moderatorId;
    await dbUser.save();

    // Strip roles and add Hapis role
    if (currentRoles.length > 0) {
      await member.roles.remove(currentRoles, `Hapis Cezası: ${reason}`).catch(() => {});
    }
    await member.roles.add(hapisRole, `Hapis Cezası: ${reason}`).catch(() => {});

    // Send DM to target
    await member.send(
      `🔒 **Hapishaneye Gönderildiniz!**\n\n` +
      `**Gerekçe:** ${reason}\n` +
      `**Süre:** ${durationMinutes} dakika\n` +
      `Cezanız bittiğinde rolleriniz iade edilecektir.`
    ).catch(() => {});

    // Log in channel 1521502699324178492
    const logChannel = guild.channels.cache.get("1521502699324178492");
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setTitle("🔒 HAPİS CEZASI UYGULANDI")
        .setColor(0x7f8c8d)
        .addFields(
          { name: "👤 Cezalandırılan Üye", value: `${member.toString()} (\`${member.user.tag}\`)`, inline: true },
          { name: "👮 Yetkili", value: `<@${moderatorId}>`, inline: true },
          { name: "🕒 Süre", value: `${durationMinutes} Dakika (Bitiş: <t:${Math.floor(dbUser.jailedUntil.getTime() / 1000)}:R>)`, inline: true },
          { name: "📋 Gerekçe", value: reason, inline: false }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    return true;
  } catch (err) {
    console.error("[JailService] jailUser error:", err);
    return false;
  }
}

/**
 * Unjails a user.
 */
async function unjailUser(client, guild, userId) {
  try {
    const dbUser = await User.findOne({ discordId: userId });
    if (!dbUser || !dbUser.isJailed) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const hapisRole = guild.roles.cache.find(r => r.name.toLowerCase() === "hapis");
      if (hapisRole) {
        await member.roles.remove(hapisRole, "Hapis Süresi Bitti").catch(() => {});
      }

      const restoredRoles = dbUser.jailedRoles || [];
      if (restoredRoles.length > 0) {
        // Re-add their old roles
        await member.roles.add(restoredRoles, "Hapis Süresi Bitti (Roller İade Edildi)").catch(() => {});
      }

      await member.send(
        `🔓 **Hapis Cezanız Sona Erdi!**\n\n` +
        `Rolleriniz iade edildi. Lütfen kurallara uymaya özen gösterin.`
      ).catch(() => {});
    }

    dbUser.isJailed = false;
    dbUser.jailedRoles = undefined;
    dbUser.jailedUntil = undefined;
    dbUser.jailReason = undefined;
    dbUser.jailedBy = undefined;
    await dbUser.save();

    // Log unjail
    const logChannel = guild.channels.cache.get("1521502699324178492");
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = new EmbedBuilder()
        .setTitle("🔓 HAPİS SÜRESİ BİTTİ (TAHLİYE)")
        .setColor(0x2ecc71)
        .setDescription(`👤 **Kullanıcı:** <@${userId}> (\`${userId}\`)\n🔓 Durum: Tahliye edildi ve rolleri iade edildi.`)
        .setTimestamp();
      await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }
  } catch (err) {
    console.error("[JailService] unjailUser error:", err);
  }
}

/**
 * Periodically scans for users whose jail time has expired.
 */
function startJailScheduler(client) {
  console.log("[JailScheduler] Hapis süresi takip zamanlayıcısı başlatıldı.");
  setInterval(async () => {
    try {
      const jailedUsers = await User.find({ isJailed: true });
      if (jailedUsers.length === 0) return;

      const guild = client.guilds.cache.get("1367646464804655104") || client.guilds.cache.first();
      if (!guild) return;

      const now = new Date();
      for (const dbUser of jailedUsers) {
        if (dbUser.jailedUntil && now >= new Date(dbUser.jailedUntil)) {
          console.log(`[JailScheduler] 🔓 Jailed user ${dbUser.discordId} has expired. Unjailing...`);
          await unjailUser(client, guild, dbUser.discordId);
        }
      }
    } catch (err) {
      console.error("[JailScheduler] Error running jail scanner:", err);
    }
  }, 30000);
}

module.exports = {
  jailUser,
  unjailUser,
  startJailScheduler,
  setupHapisRoleOverwrites
};
