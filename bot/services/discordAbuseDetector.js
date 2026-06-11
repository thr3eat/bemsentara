const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require("discord.js");
const { SERVER_INVITE_LINKS } = require("../../config");

// ─── İzlenen sunucular ────────────────────────────────────────────────────────
const MONITORED_GUILDS = {
  "1514569307886063666": "TMT | Turkish Armed Forces",
  "1367646464804655104": "EkoYıldız",
  "1414639355456389344": "BEM Sentara"
};

// ─── Gece saatleri kontrol ────────────────────────────────────────────────────
function isNightHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 0 && hour < 8; // 00:00 - 08:00
}

// ─── Gece modu otomatik ban tracker ───────────────────────────────────────────
// `${guildId}_${userId}` → { timestamp, type, details }
const nightModePendingBans = new Map();

// ─── BAN LOG KANALI ───────────────────────────────────────────────────────────
const BAN_LOG_CHANNEL_ID = "1504201531551907941";

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

  // ─── GECE MODU: Otomatik ban başlatılacak ──────────────────────────────────
  if (isNightHours()) {
    const key = `${guild.id}_${executor.id}`;
    
    // Eğer bu kişi için zaten bir ban bekliyorsa, ek kaydı yazma
    if (!nightModePendingBans.has(key)) {
      nightModePendingBans.set(key, {
        timestamp: Date.now(),
        type,
        guild,
        executor,
        detailLines,
        client,
      });

      // 1 dakika sonra otomatik ban kontrol et
      setTimeout(async () => {
        const pending = nightModePendingBans.get(key);
        if (!pending) return; // Bu sürede manual işlem yapılmış

        await executeNightModeAutoBan(client, guild, executor, type, detailLines);
        nightModePendingBans.delete(key);
      }, 60_000); // 1 dakika = 60000 ms

      console.log(`[NightMode] ⏳ ${guild.name} — ${executor.tag} için 1 dakika bekleme başlandı`);
    }
    return; // Gece modunda manuel alert göndermiyoruz
  }

  let alertCh = null;
  try {
    const alertGuild = client.guilds.cache.get("1483482948320891074");
    if (!alertGuild) return;
    alertCh = alertGuild.channels.cache.get("1514685613830574272");
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

/**
 * GECE MODU: Otomatik ban ve grup atılması işlemi
 */
async function executeNightModeAutoBan(client, guild, executor, type, detailLines) {
  console.log(`[NightMode] 🔨 Otomatik ban başladı: ${guild.name} — ${executor.tag}`);

  // ─── 1. Discord sunucusundan banla ──────────────────────────────────────────
  try {
    await guild.members.ban(executor.id, {
      reason: `Abuse şüphesi (${type}) — Gece otomatik ban sistem`
    });
    console.log(`[NightMode] ✅ ${guild.name} — ${executor.tag} banlandı`);
  } catch (err) {
    console.error(`[NightMode] Ban hatası (${guild.name}):`, err.message);
  }

  // ─── 2. Roblox gruptan atma (TMT grup için) ──────────────────────────────────
  if (guild.id === "1514569307886063666") {
    try {
      console.log(`[NightMode] 📤 Roblox grup atılması işlemi başlatıldı: ${executor.tag}`);
    } catch (err) {
      console.warn(`[NightMode] Roblox işlemi başlatma hatası:`, err.message);
    }
  }

  // ─── 3. Ban loguna mesaj gönder ────────────────────────────────────────────
  try {
    const targetGuild = await client.guilds.fetch(guild.id);
    const banLogChannel = targetGuild.channels.cache.get("1504201531551907941");
    
    if (banLogChannel && banLogChannel.isTextBased()) {
      const banEmbed = new EmbedBuilder()
        .setTitle("🔨 GECE OTOMOTIK BAN")
        .setColor(0xFF0000)
        .addFields(
          { name: "👤 Banlanan Kullanıcı", value: `${executor.tag}\n\`${executor.id}\``, inline: true },
          { name: "🏠 Sunucu", value: `${MONITORED_GUILDS[guild.id] || guild.name}\n\`${guild.id}\``, inline: true },
          { name: "⚠️ Sebep", value: `Abuse şüphesi (${type})\nGece saatleri otomatik ban`, inline: false },
          { name: "🕐 Zaman", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: "↩️ Geri Alma", value: "Ban log kanalında geri al butonuna tıklayın", inline: true }
        )
        .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      const unbanBtn = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`night_unban_${guild.id}_${executor.id}`)
          .setLabel("↩️ Banı Geri Al")
          .setStyle(ButtonStyle.Success)
          .setEmoji("↩️")
      );

      await banLogChannel.send({ embeds: [banEmbed], components: [unbanBtn] });
    }
  } catch (err) {
    console.warn(`[NightMode] Ban log kanal hatası:`, err.message);
  }

  // ─── 4. Admin ID'lerine DM gönder ──────────────────────────────────────────
  const NIGHT_ADMIN_IDS = ["1078049507230625963", "1031620522406072350"];
  for (const adminId of NIGHT_ADMIN_IDS) {
    try {
      const admin = await client.users.fetch(adminId);
      
      const adminEmbed = new EmbedBuilder()
        .setTitle("🚨 GECE OTOMOTIK BAN ÖZETİ")
        .setColor(0xFF0000)
        .setDescription(
          `${MONITORED_GUILDS[guild.id] || guild.name} sunucusunda geç saatlerde abuse şüphesi tespit edildi. ` +
          `Yanıt gelmediği için sistem otomatik olarak kullanıcıyı banladı.`
        )
        .addFields(
          { name: "👤 Banlanan", value: `${executor.tag}\n\`${executor.id}\``, inline: true },
          { name: "🏠 Sunucu", value: `${MONITORED_GUILDS[guild.id] || guild.name}`, inline: true },
          { name: "⚠️ Abuse Tipi", value: type, inline: true },
          { name: "🕐 Zaman", value: new Date().toLocaleString('tr-TR'), inline: true },
          { name: "📋 Detaylar", value: detailLines.join("\n") || "Detay yok", inline: false }
        )
        .setThumbnail(executor.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await admin.send({
        content: `⚠️ **Uyarı:** Gece otomatik ban sistemi tarafından bir kullanıcı banlandı.\n**Sebep:** Abuse şüphesi — ${type}`,
        embeds: [adminEmbed]
      });
    } catch (err) {
      console.warn(`[NightMode] Admin DM hatası (${adminId}):`, err.message);
    }
  }

  // ─── 5. Banlanan kullanıcıya DM gönder ────────────────────────────────────
  try {
    const userEmbed = new EmbedBuilder()
      .setTitle("⛔ BAN BİLDİRİMİ")
      .setColor(0xFF0000)
      .setDescription(
        `${MONITORED_GUILDS[guild.id] || guild.name} sunucusundan **banlandınız**.\n\n` +
        `**Sebep:** Abuse şüphesi — Gece saatleri otomatik ban sistemi\n` +
        `**Zaman:** Geç saatlerde (00:00-08:00)\n\n` +
        `**Banınızı Geri Almak İçin:**\n` +
        `1. Abuse Log kanalına gidin\n` +
        `2. Banlandığınız mesajın altında bulunan **↩️ Banı Geri Al** butonuna tıklayın`
      )
      .setFooter({ text: "Sentara Ban Sistemi" })
      .setTimestamp();

    await executor.send({ embeds: [userEmbed] });
  } catch (err) {
    console.warn(`[NightMode] Kullanıcı DM hatası:`, err.message);
  }
}

/**
 * Gece otomatik ban sonrası banı geri alma (buton)
 */
async function handleNightUnbanButton(interaction) {
  if (!interaction.customId?.startsWith('night_unban_')) return false;

  const parts = interaction.customId.split('_');
  const guildId = parts[2];
  const userId = parts[3];

  try {
    const guild = await interaction.client.guilds.fetch(guildId);
    const user = await interaction.client.users.fetch(userId);

    // Ban'ı kaldır
    await guild.bans.remove(userId, "Gece otomatik ban geri alındı");

    // Banı geri alan kişiye bildir
    await interaction.reply({
      content: `✅ **${user.tag}** kullanıcısının banı geri alındı.`,
      ephemeral: true
    });

    // Sunucu davet linki
    const inviteLink = SERVER_INVITE_LINKS[guildId] || `https://discord.gg/`;
    const guildName = MONITORED_GUILDS[guildId] || guild.name;

    // Banlanan kişiye DM gönder
    const userEmbed = new EmbedBuilder()
      .setTitle("✅ BAN GERİ ALINDI")
      .setColor(0x00FF00)
      .setDescription(
        `${guildName} sunucusundaki banınız geri alındı.\n\n` +
        `**Geri Alan:** ${interaction.user.tag}\n` +
        `**Sebep:** Gece otomatik ban sisteminin devreye alınmasından dolayı üzgünüz. ` +
        `Lütfen dikkatli olun ve kurallara uyun.\n\n` +
        `**Sunucuya Geri Dönüş:**\n` +
        `${inviteLink}`
      )
      .setFooter({ text: "Sentara Ban Sistemi" })
      .setTimestamp();

    await user.send({ embeds: [userEmbed] }).catch(() => {});

    console.log(`[NightMode] ✅ ${user.tag} (${userId}) banı geri alındı`);
  } catch (err) {
    console.error(`[NightMode] Ban geri alma hatası:`, err.message);
    await interaction.reply({
      content: `❌ Ban geri alma işleminde hata oluştu: ${err.message}`,
      ephemeral: true
    });
  }

  return true;
}

module.exports = { 
  startDiscordAbuseDetector, 
  MONITORED_GUILDS,
  handleNightUnbanButton,
};
