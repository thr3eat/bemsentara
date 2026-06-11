const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require("discord.js");

// ─── İzlenen sunucular ────────────────────────────────────────────────────────
const MONITORED_GUILDS = {
  "1514569307886063666": "TMT | Turkish Armed Forces",
  "1367646464804655104": "EkoYıldız",
  "1414639355456389344": "BEM Sentara"
};

// ─── Alert kanalı (Müttefik Orduları) ────────────────────────────────────────
const ALERT_GUILD_ID   = "1483482948320891074";
const ALERT_CHANNEL_ID = "1514685613830574272";

// ─── Tespit eşikleri ──────────────────────────────────────────────────────────
const THRESHOLDS = {
  BAN:            { count: 3,  windowMs: 20_000, label: "🔨 Toplu Banlama",           color: 0xFF0000 },
  KICK:           { count: 3,  windowMs: 20_000, label: "👢 Toplu Üye Atma",          color: 0xFF4500 },
  CHANNEL_DELETE: { count: 2,  windowMs: 20_000, label: "🗑️ Toplu Kanal Silme",      color: 0xFF6600 },
  ROLE_DELETE:    { count: 2,  windowMs: 20_000, label: "🗑️ Toplu Rol Silme",        color: 0xFF8800 },
  WEBHOOK_CREATE: { count: 3,  windowMs: 30_000, label: "🪝 Toplu Webhook Oluşturma",color: 0xFFAA00 },
  MASS_MENTION:   { count: 1,  windowMs: 0,      label: "📣 Toplu Etiketleme / Ping", color: 0xFF2200 },
};

// ─── Durum ───────────────────────────────────────────────────────────────────
// `${guildId}_${userId}_${type}` → [timestamp, ...]
const actionTracker = new Map();
// Aynı kişi/eylem için kısa sürede tekrar alert atmayı önle
const lastAlertSent = new Map();
const ALERT_COOLDOWN_MS = 25_000;

// ─── Sliding window tracker ───────────────────────────────────────────────────
/**
 * Bir eylemi kaydeder. Eşik aşılmışsa true döner.
 */
function trackAction(guildId, userId, type) {
  if (type === "MASS_MENTION") return true; // Her zaman hemen tetikle

  const cfg = THRESHOLDS[type];
  if (!cfg) return false;

  const key  = `${guildId}_${userId}_${type}`;
  const now  = Date.now();

  if (!actionTracker.has(key)) actionTracker.set(key, []);
  const times    = actionTracker.get(key);
  times.push(now);

  // Pencere dışındakileri temizle
  const filtered = times.filter(t => now - t < cfg.windowMs);
  actionTracker.set(key, filtered);

  return filtered.length >= cfg.count;
}

function recentCount(guildId, userId, type) {
  const cfg = THRESHOLDS[type];
  if (!cfg) return 0;
  const key    = `${guildId}_${userId}_${type}`;
  const times  = actionTracker.get(key) || [];
  const now    = Date.now();
  return times.filter(t => now - t < cfg.windowMs).length;
}

function canSendAlert(guildId, userId, type) {
  const key  = `${guildId}_${userId}_${type}`;
  const last = lastAlertSent.get(key) || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return false;
  lastAlertSent.set(key, Date.now());
  return true;
}

// ─── Audit log'dan işlemi yapan kişiyi bul ───────────────────────────────────
/**
 * Belirtilen eylem türü için son audit log girdisindeki executor'ı döndürür.
 * maxAgeSec: kaç saniye öncesine kadar geçerli kabul edilsin
 */
async function fetchExecutor(guild, auditLogEvent, targetId = null, maxAgeSec = 8) {
  try {
    const logs  = await guild.fetchAuditLogs({ type: auditLogEvent, limit: 5 });
    const now   = Date.now();

    for (const entry of logs.entries.values()) {
      const age = (now - entry.createdAt.getTime()) / 1000;
      if (age > maxAgeSec) continue;
      if (targetId && entry.target?.id !== targetId) continue;
      if (entry.executor?.bot) continue; // Botların kendi aksiyonlarını yoksay
      return entry.executor;
    }
  } catch (_) {}
  return null;
}

// ─── Alert mesajı gönder ──────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {import('discord.js').Client} opts.client
 * @param {import('discord.js').Guild} opts.guild
 * @param {import('discord.js').User} opts.executor
 * @param {string} opts.type
 * @param {string[]} opts.detailLines
 */
async function sendDiscordAbuseAlert(client, { guild, executor, type, detailLines = [] }) {
  if (!canSendAlert(guild.id, executor.id, type)) return;

  let alertCh = null;
  try {
    const alertGuild = client.guilds.cache.get(ALERT_GUILD_ID);
    if (!alertGuild) return;
    alertCh = alertGuild.channels.cache.get(ALERT_CHANNEL_ID);
    if (!alertCh || !alertCh.isTextBased()) return;
  } catch (_) { return; }

  const cfg     = THRESHOLDS[type];
  const gName   = MONITORED_GUILDS[guild.id] || guild.name;
  const count   = recentCount(guild.id, executor.id, type);
  const unix    = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle("🚨 DISCORD SUNUCU ABUSE ŞÜPHESİ")
    .setDescription(
      `**${gName}** sunucusunda şüpheli bir aktivite tespit edildi!\n\n` +
      `> **${cfg.label}**\n` +
      (count > 1 ? `> ⚡ Son 20 saniyede **${count} kez** gerçekleşti\n` : "") +
      `\n⚠️ Aşağıdaki butonlarla müdahale edebilirsiniz.`
    )
    .setColor(cfg.color)
    .addFields(
      { name: "🏠 Sunucu",            value: `**${gName}**\nID: \`${guild.id}\``,                                                    inline: true  },
      { name: "👤 Şüpheli Kullanıcı", value: `${executor.toString()}\n\`${executor.tag}\`\nID: \`${executor.id}\``,                 inline: true  },
      { name: "⚠️ Tespit Edilen",     value: cfg.label,                                                                              inline: true  },
      { name: "🕐 Tespit Zamanı",     value: `<t:${unix}:F>\n(<t:${unix}:R>)`,                                                      inline: true  },
      { name: "🌐 Sunucu Bilgisi",    value: `Üye: **${guild.memberCount}**\nSunucu ID: \`${guild.id}\``,                           inline: true  },
      { name: "🔍 Şüpheli Kişi",      value: `Hesap: <@${executor.id}>\nTag: \`${executor.tag}\`\nID: \`${executor.id}\``,          inline: true  }
    )
    .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
    .setTimestamp()
    .setFooter({ text: "Sentara Discord Abuse Tespit Sistemi", iconURL: client.user.displayAvatarURL() });

  if (detailLines.length > 0) {
    embed.addFields({
      name:  "📋 Tespit Detayları",
      value: detailLines.slice(0, 15).join("\n").slice(0, 1024),
      inline: false
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`disc_abuse_removeroles_${guild.id}_${executor.id}`)
      .setLabel("🗑️ Rolleri Al")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🗑️"),
    new ButtonBuilder()
      .setCustomId(`disc_abuse_kick_${guild.id}_${executor.id}`)
      .setLabel("👢 At")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("👢"),
    new ButtonBuilder()
      .setCustomId(`disc_abuse_ban_${guild.id}_${executor.id}`)
      .setLabel("🔨 Banla")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔨"),
    new ButtonBuilder()
      .setCustomId(`disc_abuse_ignore_${guild.id}_${executor.id}`)
      .setLabel("🚫 Yoksay")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🚫")
  );

  await alertCh.send({ embeds: [embed], components: [row] }).catch(err =>
    console.error("[DiscordAbuseDetector] Alert gönderilemedi:", err.message)
  );

  console.log(`[DiscordAbuseDetector] 🚨 ${gName} — ${executor.tag} (${executor.id}) — ${cfg.label}`);
}

// ─── Olay işleyicileri ────────────────────────────────────────────────────────

async function handleBanAdd(client, ban) {
  if (!MONITORED_GUILDS[ban.guild.id]) return;
  const executor = await fetchExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
  if (!executor) return;

  const exceeded = trackAction(ban.guild.id, executor.id, "BAN");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       ban.guild,
    executor,
    type:        "BAN",
    detailLines: [`• Banlanan: **${ban.user.tag}** (\`${ban.user.id}\`)`]
  });
}

async function handleChannelDelete(client, channel) {
  if (!channel.guild || !MONITORED_GUILDS[channel.guild.id]) return;
  const executor = await fetchExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
  if (!executor) return;

  const exceeded = trackAction(channel.guild.id, executor.id, "CHANNEL_DELETE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       channel.guild,
    executor,
    type:        "CHANNEL_DELETE",
    detailLines: [`• Silinen Kanal: **#${channel.name}** (${channel.type === 0 ? "Metin" : "Ses"} Kanalı)`]
  });
}

async function handleRoleDelete(client, role) {
  if (!MONITORED_GUILDS[role.guild.id]) return;
  const executor = await fetchExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
  if (!executor) return;

  const exceeded = trackAction(role.guild.id, executor.id, "ROLE_DELETE");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       role.guild,
    executor,
    type:        "ROLE_DELETE",
    detailLines: [`• Silinen Rol: **${role.name}** (\`${role.id}\`)`]
  });
}

async function handleMemberRemove(client, member) {
  if (!MONITORED_GUILDS[member.guild.id]) return;
  // Ayrılma mı atılma mı kontrol et
  const executor = await fetchExecutor(member.guild, AuditLogEvent.MemberKick, member.id, 5);
  if (!executor) return; // Sadece ayrılma — atılma değil

  const exceeded = trackAction(member.guild.id, executor.id, "KICK");
  if (!exceeded) return;

  await sendDiscordAbuseAlert(client, {
    guild:       member.guild,
    executor,
    type:        "KICK",
    detailLines: [`• Atılan Üye: **${member.user.tag}** (\`${member.id}\`)`]
  });
}

async function handleMassMention(client, message) {
  if (!message.guild || !MONITORED_GUILDS[message.guild.id]) return;
  if (message.author.bot) return;

  const hasEveryonePing = message.mentions.everyone; // @everyone veya @here
  const userMentions    = message.mentions.users.size;

  if (!hasEveryonePing && userMentions < 10) return;

  const detailLines = [];
  if (hasEveryonePing)      detailLines.push("• `@everyone` veya `@here` etiketlendi");
  if (userMentions >= 10)   detailLines.push(`• **${userMentions}** farklı kullanıcı tek mesajda etiketlendi`);
  detailLines.push(`• Kanal: <#${message.channel.id}>`);
  detailLines.push(`• Mesaj: ${message.content.slice(0, 200)}`);

  await sendDiscordAbuseAlert(client, {
    guild:       message.guild,
    executor:    message.author,
    type:        "MASS_MENTION",
    detailLines
  });
}

/**
 * Tüm Discord Abuse event listener'larını başlatır.
 */
function startDiscordAbuseDetector(client) {
  const gNames = Object.values(MONITORED_GUILDS).join(", ");
  console.log(`[DiscordAbuseDetector] Başlatıldı — İzlenen Sunucular: ${gNames}`);

  client.on("guildBanAdd",       (ban)     => handleBanAdd(client, ban).catch(e => console.error("[AbuseDetector] guildBanAdd:", e.message)));
  client.on("channelDelete",     (ch)      => handleChannelDelete(client, ch).catch(e => console.error("[AbuseDetector] channelDelete:", e.message)));
  client.on("roleDelete",        (role)    => handleRoleDelete(client, role).catch(e => console.error("[AbuseDetector] roleDelete:", e.message)));
  client.on("guildMemberRemove", (member)  => handleMemberRemove(client, member).catch(e => console.error("[AbuseDetector] guildMemberRemove:", e.message)));
  client.on("messageCreate",     (msg)     => handleMassMention(client, msg).catch(e => console.error("[AbuseDetector] massMention:", e.message)));
}

module.exports = { startDiscordAbuseDetector, MONITORED_GUILDS };
